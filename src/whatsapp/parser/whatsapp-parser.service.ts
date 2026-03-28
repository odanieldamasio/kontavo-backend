import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { ParsedWhatsappMessage } from '../interfaces/parsed-message.interface';

@Injectable()
export class WhatsappParserService {
  parse(text: string): ParsedWhatsappMessage | null {
    const normalized = text.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return null;
    }

    const [rawIntent, rawAmount, ...rest] = normalized.split(' ');
    const amount = this.parseAmount(rawAmount);
    const description = rest.join(' ').trim();

    if (!amount || !description) {
      return null;
    }

    const intent = rawIntent.toLowerCase();

    if (intent === 'gasto') {
      return {
        type: TransactionType.EXPENSE,
        amount,
        description
      };
    }

    if (intent === 'recebi') {
      return {
        type: TransactionType.INCOME,
        amount,
        description
      };
    }

    return null;
  }

  private parseAmount(rawAmount: string | undefined): number | null {
    if (!rawAmount) {
      return null;
    }

    const normalized = this.normalizeAmount(rawAmount);
    const value = Number(normalized);

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return value;
  }

  private normalizeAmount(rawAmount: string): string {
    const cleaned = rawAmount.replace(/[^\d.,]/g, '');
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');

      // Keep the last separator as decimal and treat the other as thousand separator.
      return lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    }

    if (hasComma) {
      const lastComma = cleaned.lastIndexOf(',');
      const fractional = cleaned.slice(lastComma + 1);
      return fractional.length <= 2
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    }

    if (hasDot) {
      const lastDot = cleaned.lastIndexOf('.');
      const fractional = cleaned.slice(lastDot + 1);
      return fractional.length <= 2
        ? cleaned.replace(/,/g, '')
        : cleaned.replace(/\./g, '');
    }

    return cleaned;
  }
}
