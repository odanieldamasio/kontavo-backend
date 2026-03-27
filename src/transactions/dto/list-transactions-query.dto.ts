import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ enum: TransactionType })
  type?: TransactionType;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  endDate?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  page?: string | number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  limit?: string | number;
}
