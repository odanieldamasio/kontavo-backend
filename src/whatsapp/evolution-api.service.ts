import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendText(remoteJid: string, text: string): Promise<void> {
    const baseUrl = this.configService
      .getOrThrow<string>('EVOLUTION_API_URL')
      .replace(/\/$/, '');
    const apiKey = this.configService.getOrThrow<string>('EVOLUTION_API_KEY');
    const instanceName = this.configService.getOrThrow<string>('EVOLUTION_INSTANCE_NAME');

    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey
      },
      body: JSON.stringify({
        number: this.normalizeRecipient(remoteJid),
        text,
        delay: 1200
      })
    });

    if (!response.ok) {
      const responseText = await response.text();

      this.logger.error(
        `Evolution API rejected sendText with status ${response.status}: ${responseText || 'empty body'}`
      );

      throw new Error(`Evolution API error: ${response.status}`);
    }
  }

  private normalizeRecipient(remoteJid: string): string {
    return remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
  }
}
