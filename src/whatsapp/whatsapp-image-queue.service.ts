import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  TransactionSource,
  TransactionType,
  WhatsappMessageDirection
} from '@prisma/client';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { TransactionsService } from '../transactions/transactions.service';
import {
  WHATSAPP_DEFAULT_CATEGORY_NAME,
  WHATSAPP_IMAGE_PARSE_QUEUE
} from './constants/whatsapp.constants';
import { EvolutionApiService } from './evolution-api.service';
import { EvolutionWebhookPayload } from './interfaces/evolution-webhook.interface';
import { OpenAiParsingError, OpenAiService } from './openai.service';
import { WhatsappQueueService } from './whatsapp-queue.service';

interface WhatsappImageParseJob {
  userId: string;
  remoteJid: string;
  messageId: string;
  key: EvolutionWebhookPayload['key'];
  message: EvolutionWebhookPayload['message'];
  rawPayload: Prisma.InputJsonValue;
}

interface CachedParsedImage {
  amount: number;
  type: TransactionType;
  description: string;
  date: string | null;
}

@Injectable()
export class WhatsappImageQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappImageQueueService.name);
  private readonly queue: Queue<WhatsappImageParseJob>;
  private readonly worker: Worker<WhatsappImageParseJob>;
  private readonly cacheTtlSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly openAiService: OpenAiService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly whatsappQueueService: WhatsappQueueService
  ) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');
    const redisUri = new URL(redisUrl);
    const dbFromPath = Number(redisUri.pathname.replace('/', ''));
    const connection = {
      host: redisUri.hostname,
      port: Number(redisUri.port || 6379),
      password: redisUri.password ? decodeURIComponent(redisUri.password) : undefined,
      db: Number.isFinite(dbFromPath) ? dbFromPath : 0,
      tls: redisUri.protocol === 'rediss:' ? {} : undefined
    };

    this.cacheTtlSeconds = configService.get<number>(
      'WHATSAPP_IMAGE_CACHE_TTL_SECONDS',
      60 * 60 * 24 * 7
    );
    this.queue = new Queue<WhatsappImageParseJob>(WHATSAPP_IMAGE_PARSE_QUEUE, {
      connection
    });
    this.worker = new Worker<WhatsappImageParseJob>(
      WHATSAPP_IMAGE_PARSE_QUEUE,
      async (job) => this.processImage(job),
      {
        connection
      }
    );
    this.worker.on('failed', (job) => {
      if (!job) {
        return;
      }

      const attempts = job.opts.attempts ?? 1;

      const failedReason = job.failedReason.toLowerCase();
      const isOpenAiQuotaError =
        failedReason.includes('insufficient_quota') ||
        failedReason.includes('exceeded your current quota');

      if (job.attemptsMade >= attempts || isOpenAiQuotaError) {
        const text = isOpenAiQuotaError
          ? '⚠️ Nao consegui processar sua imagem: limite da IA atingido no momento.'
          : '⚠️ Nao consegui processar sua imagem agora.';

        void this.whatsappQueueService.enqueueOutbound({
          userId: job.data.userId,
          remoteJid: job.data.remoteJid,
          text,
          rawPayload: {
            source: 'whatsapp-image-ai',
            inReplyTo: job.data.messageId
          }
        });
      }
    });
  }

  async enqueue(job: WhatsappImageParseJob): Promise<void> {
    await this.queue.add('parse-image', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1500
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  private async processImage(job: Job<WhatsappImageParseJob>): Promise<void> {
    const media = await this.evolutionApiService.getMediaBase64FromMessage({
      key: job.data.key,
      message: job.data.message
    });
    const compressedBuffer = await this.compressImage(media.buffer);
    const cacheKey = `whatsapp:image-parse:${this.hashBuffer(compressedBuffer)}`;
    const cached = await this.redisService.get(cacheKey);
    const parsed = cached
      ? this.parseCachedResult(cached)
      : await this.parseImageWithAi(compressedBuffer);

    if (!cached) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(parsed),
        this.cacheTtlSeconds
      );
    }

    const categoryId = await this.getOrCreateWhatsappCategoryId(job.data.userId);
    const transaction = await this.transactionsService.create(job.data.userId, {
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
      categoryId,
      source: TransactionSource.WHATSAPP
    } satisfies CreateTransactionDto);

    await this.prismaService.whatsappMessage.updateMany({
      where: {
        messageId: job.data.messageId
      },
      data: {
        transactionId: transaction.id,
        parsed: true
      }
    });

    await this.whatsappQueueService.enqueueOutbound({
      userId: job.data.userId,
      remoteJid: job.data.remoteJid,
      text:
        parsed.type === TransactionType.EXPENSE
          ? `✅ Gasto de R$${this.formatAmount(parsed.amount)} registrado: ${parsed.description}`
          : `✅ Receita de R$${this.formatAmount(parsed.amount)} registrada: ${parsed.description}`,
      rawPayload: {
        source: 'whatsapp-image-ai',
        inReplyTo: job.data.messageId
      }
    });
  }

  private async compressImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 65,
        mozjpeg: true
      })
      .toBuffer();
  }

  private async parseImageWithAi(buffer: Buffer): Promise<CachedParsedImage> {
    try {
      return await this.openAiService.parseTransactionFromImage(buffer, 'image/jpeg');
    } catch (error) {
      if (error instanceof OpenAiParsingError && !error.options.retryable) {
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private parseCachedResult(value: string): CachedParsedImage {
    const parsed = JSON.parse(value) as CachedParsedImage;

    if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
      throw new Error('Invalid cached amount');
    }

    if (!parsed.description?.trim()) {
      throw new Error('Invalid cached description');
    }

    if (parsed.type !== TransactionType.EXPENSE && parsed.type !== TransactionType.INCOME) {
      throw new Error('Invalid cached type');
    }

    return parsed;
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
