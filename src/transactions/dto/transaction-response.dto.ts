import { ApiProperty } from '@nestjs/swagger';
import { TransactionSource, TransactionType } from '@prisma/client';

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty({ example: '129.90' })
  amount!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  date!: Date;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty({ enum: TransactionSource })
  source!: TransactionSource;

  @ApiProperty({ nullable: true })
  receiptUrl!: string | null;

  @ApiProperty({ nullable: true })
  deletedAt!: Date | null;
}
