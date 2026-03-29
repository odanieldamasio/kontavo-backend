import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import {
  Prisma,
  TransactionSource,
  TransactionType,
  WhatsappMessage,
  WhatsappMessageDirection
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CategoriesService } from '../categories/categories.service';
import { PlanService } from '../common/plan/plan.service';
import { PrismaService } from '../database/prisma.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { WHATSAPP_DEFAULT_CATEGORY_NAME } from './constants/whatsapp.constants';
import { EvolutionWebhookPayload } from './interfaces/evolution-webhook.interface';
import { WhatsappParserService } from './parser/whatsapp-parser.service';
import { WhatsappImageQueueService } from './whatsapp-image-queue.service';
import { WhatsappQueueService } from './whatsapp-queue.service';

@Injectable()
export class WhatsappService {
  private static readonly SUPPORTED_EVENTS = new Set([
    'MESSAGES_UPSERT',
    'messages.upsert'
  ]);
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
    private readonly planService: PlanService,
    private readonly parserService: WhatsappParserService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly whatsappImageQueueService: WhatsappImageQueueService,
    private readonly whatsappQueueService: WhatsappQueueService
  ) {}

  validateWebhookToken(token: string | undefined): void {
    const expected = this.configService.get<string>('WHATSAPP_WEBHOOK_TOKEN', '');

    if (expected && token !== expected) {
      throw new UnauthorizedException('Invalid webhook token');
    }
  }

  async handleWebhook(payload: EvolutionWebhookPayload): Promise<void> {
    if (!this.isSupportedEvent(payload.event)) {
      return;
    }

    const extracted = this.extractMessage(payload);
    const hasImage = extracted ? this.hasImageMessage(extracted.message) : false;

    if (!extracted || (!extracted.text && !hasImage)) {
      return;
    }

    if (extracted.fromMe && !hasImage) {
      this.logger.debug(
        `Ignoring WhatsApp text message ${extracted.messageId} because fromMe=true`
      );
      return;
    }

    if (extracted.fromMe && hasImage) {
      this.logger.debug(
        `Accepting WhatsApp image message ${extracted.messageId} even with fromMe=true`
      );
    }

    const existingInboundMessage = await this.findInboundMessageByExternalId(
      extracted.messageId
    );

    if (existingInboundMessage) {
      this.logger.debug(
        `Ignoring duplicated WhatsApp webhook for message ${extracted.messageId}`
      );
      return;
    }

    const user = await this.usersService.findByNormalizedPhone(extracted.remoteJid);
    const parsed = extracted.text ? this.parserService.parse(extracted.text) : null;
    let transactionId: string | null = null;

    await this.persistInboundMessage({
      userId: user?.id ?? null,
      messageId: extracted.messageId,
      remoteJid: extracted.remoteJid,
      text: extracted.text,
      parsed: hasImage ? false : Boolean(parsed),
      rawPayload: payload as Prisma.InputJsonValue
    });

    if (!user) {
      this.logger.warn(
        `Ignoring WhatsApp message ${extracted.messageId} because no user was found for ${extracted.remoteJid}`
      );
      return;
    }

    const hasWhatsappFeature = await this.planService.hasFeature(user.id, 'whatsapp');

    if (!hasWhatsappFeature) {
      await this.whatsappQueueService.enqueueOutbound({
        userId: user.id,
        remoteJid: extracted.remoteJid,
        text: '⚠️ Recurso de WhatsApp indisponivel no seu plano atual.',
        rawPayload: {
          source: 'whatsapp-module',
          inReplyTo: extracted.messageId,
          code: 'FEATURE_NOT_AVAILABLE'
        }
      });
      return;
    }

    if (this.hasImageMessage(extracted.message)) {
      await this.whatsappImageQueueService.enqueue({
        userId: user.id,
        remoteJid: extracted.remoteJid,
        messageId: extracted.messageId,
        key: extracted.key,
        message: extracted.message,
        rawPayload: payload as Prisma.InputJsonValue
      });
      return;
    }

    let replyText = '⚠️ Nao entendi. Exemplo: "gasto 50 pizza"';

    if (parsed) {
      try {
        const categoryId = await this.getOrCreateWhatsappCategoryId(user.id);
        const transaction = await this.transactionsService.create(user.id, {
          type: parsed.type,
          amount: parsed.amount,
          description: parsed.description,
          date: new Date().toISOString(),
          categoryId,
          source: TransactionSource.WHATSAPP
        } satisfies CreateTransactionDto);

        transactionId = transaction.id;
        replyText =
          parsed.type === TransactionType.EXPENSE
            ? `✅ Gasto de R$${this.formatAmount(parsed.amount)} registrado`
            : `✅ Receita de R$${this.formatAmount(parsed.amount)} registrada`;
      } catch (error) {
        if (error instanceof ForbiddenException) {
          replyText = '⚠️ Limite atingido para o seu plano atual.';
        } else {
          this.logger.error(
            `Failed to register WhatsApp transaction for user ${user.id}`,
            error instanceof Error ? error.stack : undefined
          );
          replyText = '⚠️ Nao consegui registrar sua transacao agora.';
        }
      }
    }

    if (transactionId) {
      await this.prismaService.whatsappMessage.updateMany({
        where: {
          messageId: extracted.messageId
        },
        data: {
          transactionId
        }
      });
    }

    await this.whatsappQueueService.enqueueOutbound({
      userId: user.id,
      remoteJid: extracted.remoteJid,
      text: replyText,
      rawPayload: {
        source: 'whatsapp-module',
        inReplyTo: extracted.messageId
      }
    });
  }

  private isSupportedEvent(event: string | undefined): boolean {
    if (!event) {
      return false;
    }

    return WhatsappService.SUPPORTED_EVENTS.has(event);
  }

  private findInboundMessageByExternalId(
    messageId: string
  ): Promise<WhatsappMessage | null> {
    return this.prismaService.whatsappMessage.findFirst({
      where: {
        messageId,
        direction: WhatsappMessageDirection.INBOUND
      }
    });
  }

  private persistInboundMessage(data: {
    userId: string | null;
    messageId: string;
    remoteJid: string;
    text: string;
    parsed: boolean;
    rawPayload: Prisma.InputJsonValue;
  }): Promise<WhatsappMessage> {
    return this.prismaService.whatsappMessage.create({
      data: {
        userId: data.userId,
        transactionId: null,
        messageId: data.messageId,
        remoteJid: data.remoteJid,
        direction: WhatsappMessageDirection.INBOUND,
        text: data.text,
        parsed: data.parsed,
        rawPayload: data.rawPayload
      }
    });
  }

  private extractMessage(payload: EvolutionWebhookPayload): {
    messageId: string;
    remoteJid: string;
    text: string;
    fromMe: boolean;
    key: EvolutionWebhookPayload['key'];
    message: EvolutionWebhookPayload['message'];
  } | null {
    const nestedMessage = Array.isArray(payload.data?.messages)
      ? payload.data.messages[0]
      : undefined;
    const key = nestedMessage?.key ?? payload.data?.key ?? payload.key;
    const message = nestedMessage?.message ?? payload.data?.message ?? payload.message;
    const messageId = key?.id;
    const remoteJidFromKey = key?.remoteJidAlt ?? key?.remoteJid;
    const remoteJidFromSender =
      this.extractSenderValue(payload.data?.sender) ??
      this.extractSenderValue(payload.sender);
    const remoteJid =
      remoteJidFromKey ??
      remoteJidFromSender;
    const text = this.extractText(message).trim();
    const fromMe = Boolean(key?.fromMe);

    if (!messageId || !remoteJid) {
      return null;
    }

    if (key?.remoteJidAlt && remoteJid === key.remoteJidAlt) {
      this.logger.debug(
        `Using remoteJidAlt (${key.remoteJidAlt}) for WhatsApp message ${messageId}`
      );
    }

    return {
      messageId,
      remoteJid,
      text,
      fromMe,
      key,
      message
    };
  }

  private extractText(
    message:
      | EvolutionWebhookPayload['message']
      | NonNullable<EvolutionWebhookPayload['data']>['message']
      | undefined
  ): string {
    return (
      message?.conversation ??
      message?.extendedTextMessage?.text ??
      message?.imageMessage?.caption ??
      message?.videoMessage?.caption ??
      ''
    );
  }

  private extractSenderValue(
    sender:
      | string
      | {
          id?: string;
          remoteJid?: string;
          remoteJidAlt?: string;
        }
      | undefined
  ): string | undefined {
    if (!sender) {
      return undefined;
    }

    if (typeof sender === 'string') {
      return sender;
    }

    return sender.remoteJidAlt ?? sender.remoteJid ?? sender.id;
  }

  private hasImageMessage(message: EvolutionWebhookPayload['message'] | undefined): boolean {
    return Boolean(message?.imageMessage);
  }

  private async getOrCreateWhatsappCategoryId(userId: string): Promise<string> {
    const existing = await this.prismaService.category.findFirst({
      where: {
        userId,
        name: WHATSAPP_DEFAULT_CATEGORY_NAME,
        deletedAt: null
      }
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.categoriesService.create(userId, {
      name: WHATSAPP_DEFAULT_CATEGORY_NAME,
      color: '#25D366',
      icon: 'message-circle',
      isDefault: false
    });

    return created.id;
  }

  private formatAmount(amount: number): string {
    return amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
}
