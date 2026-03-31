import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionSource, TransactionType } from '@prisma/client';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: TransactionType })
  type?: TransactionType;

  @ApiPropertyOptional({ example: '199.90' })
  amount?: string | number;

  @ApiPropertyOptional({ example: 'Uber aeroporto' })
  description?: string;

  @ApiPropertyOptional({ example: '2026-03-27T18:30:00.000Z' })
  date?: string;

  @ApiPropertyOptional({ example: 'cmabc1234567890' })
  categoryId?: string;

  @ApiPropertyOptional({ enum: TransactionSource })
  source?: TransactionSource;

  @ApiPropertyOptional({ example: 'https://cdn.jadeon.com/receipts/updated.png', nullable: true })
  receiptUrl?: string | null;
}
