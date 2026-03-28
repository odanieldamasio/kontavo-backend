import { TransactionType } from '@prisma/client';

export interface ParsedWhatsappMessage {
  type: TransactionType;
  amount: number;
  description: string;
}
