import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionSource, TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type!: TransactionType;

  @ApiProperty({ example: '129.90' })
  amount!: string | number;

  @ApiProperty({ example: 'Almoco de negocios' })
  description!: string;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  date!: string;

  @ApiProperty({ example: 'cmabc1234567890' })
  categoryId!: string;

  @ApiPropertyOptional({ enum: TransactionSource, default: TransactionSource.MANUAL })
  source?: TransactionSource;

  @ApiPropertyOptional({ example: 'https://cdn.kontavo.com/receipts/123.png', nullable: true })
  receiptUrl?: string;
}
