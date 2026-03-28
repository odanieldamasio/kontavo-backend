import { ApiProperty } from '@nestjs/swagger';

export class WhatsappWebhookResponseDto {
  @ApiProperty()
  received!: boolean;
}
