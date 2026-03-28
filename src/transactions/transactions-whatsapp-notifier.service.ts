import { Injectable, Logger } from '@nestjs/common';
import { TransactionType, User } from '@prisma/client';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { WhatsappQueueService } from '../whatsapp/whatsapp-queue.service';

@Injectable()
export class TransactionsWhatsappNotifierService {
  private readonly logger = new Logger(TransactionsWhatsappNotifierService.name);

  constructor(private readonly whatsappQueueService: WhatsappQueueService) {}

  async notifyCreatedTransaction(
    user: User,
    transaction: TransactionResponseDto
  ): Promise<void> {
    if (!user.phone) {
      this.logger.warn(
        `Skipping WhatsApp notification for transaction ${transaction.id} because user ${user.id} has no phone`
      );
      return;
    }

    const amountAsNumber = Number(transaction.amount);
    const formattedAmount = Number.isFinite(amountAsNumber)
      ? amountAsNumber.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })
      : transaction.amount;
    const text =
      transaction.type === TransactionType.EXPENSE
        ? `✅ Gasto de R$${formattedAmount} registrado: ${transaction.description}`
        : `✅ Receita de R$${formattedAmount} registrada: ${transaction.description}`;

    await this.whatsappQueueService.enqueueOutbound({
      userId: user.id,
      remoteJid: user.phone,
      text,
      rawPayload: {
        source: 'transactions-module',
        event: 'transaction.created',
        transactionId: transaction.id
      }
    });
  }
}
