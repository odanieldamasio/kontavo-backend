import { ApiProperty } from '@nestjs/swagger';

export class BillingUrlResponseDto {
  @ApiProperty()
  url!: string;
}
