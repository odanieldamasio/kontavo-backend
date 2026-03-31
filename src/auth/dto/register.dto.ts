import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'daniel@jadeon.com' })
  email!: string;

  @ApiProperty({ example: 'Daniel Damasio' })
  name!: string;

  @ApiProperty({ example: '12345678', minLength: 8 })
  password!: string;

  @ApiPropertyOptional({ example: '+5511999999999', nullable: true })
  phone?: string;

  @ApiPropertyOptional({ enum: PlanType, default: PlanType.FREE })
  planType?: PlanType;
}
