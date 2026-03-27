import { ApiProperty } from '@nestjs/swagger';
import { PlanType } from '@prisma/client';

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: [PlanType.ESSENTIAL, PlanType.PREMIUM] })
  planType!: PlanType;
}
