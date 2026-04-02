import { ApiProperty } from '@nestjs/swagger';

export class ValidateCheckoutFlowDto {
  @ApiProperty()
  flowToken!: string;

  @ApiProperty({ required: false, nullable: true })
  sessionId?: string;

  @ApiProperty({ enum: ['success', 'cancel'] })
  outcome!: 'success' | 'cancel';
}
