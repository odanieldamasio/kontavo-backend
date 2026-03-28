import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WhatsappWebhookResponseDto } from './dto/whatsapp-webhook-response.dto';
import { EvolutionWebhookPayload } from './interfaces/evolution-webhook.interface';
import { WhatsappService } from './whatsapp.service';

@ApiTags('Whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Public()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Webhook publico da Evolution API' })
  @ApiResponse({ status: 200, type: WhatsappWebhookResponseDto })
  @HttpCode(200)
  @Post('webhook')
  async webhook(
    @Headers('x-webhook-token') webhookToken: string | undefined,
    @Body() payload: EvolutionWebhookPayload
  ): Promise<WhatsappWebhookResponseDto> {
    this.whatsappService.validateWebhookToken(webhookToken);
    await this.whatsappService.handleWebhook(payload);

    return { received: true };
  }
}
