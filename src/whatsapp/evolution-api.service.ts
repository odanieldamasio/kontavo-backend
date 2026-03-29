import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvolutionWebhookPayload } from './interfaces/evolution-webhook.interface';

export interface EvolutionWebhookConfiguration {
  enabled?: boolean;
  url?: string;
  events?: string[];
  webhook?: EvolutionWebhookConfiguration;
}

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  constructor(private readonly configService: ConfigService) {}

  async findWebhookConfiguration(): Promise<EvolutionWebhookConfiguration | null> {
    const baseUrl = this.configService
      .getOrThrow<string>('EVOLUTION_API_URL')
      .replace(/\/$/, '');
    const apiKey = this.configService.getOrThrow<string>('EVOLUTION_API_KEY');
    const instanceName = this.configService.getOrThrow<string>('EVOLUTION_INSTANCE_NAME');
    const response = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey
      }
    });

    if (!response.ok) {
      const responseText = await response.text();

      this.logger.error(
        `Evolution API rejected webhook/find with status ${response.status}: ${responseText || 'empty body'}`
      );

      throw new Error(`Evolution API webhook/find error: ${response.status}`);
    }

    const responseText = await response.text();

    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as EvolutionWebhookConfiguration | null;
    } catch {
      return null;
    }
  }

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

  async getMediaBase64FromMessage(data: {
    key: EvolutionWebhookPayload['key'];
    message: EvolutionWebhookPayload['message'];
  }): Promise<{ buffer: Buffer; mimeType: string }> {
    const baseUrl = this.configService
      .getOrThrow<string>('EVOLUTION_API_URL')
      .replace(/\/$/, '');
    const apiKey = this.configService.getOrThrow<string>('EVOLUTION_API_KEY');
    const instanceName = this.configService.getOrThrow<string>('EVOLUTION_INSTANCE_NAME');
    const response = await fetch(
      `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey
        },
        body: JSON.stringify({
          message: {
            key: data.key,
            message: data.message
          }
        })
      }
    );

    if (!response.ok) {
      const responseText = await response.text();

      this.logger.error(
        `Evolution API rejected getBase64FromMediaMessage with status ${response.status}: ${responseText || 'empty body'}`
      );

      throw new Error(`Evolution API media error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      base64?: string;
      mimetype?: string;
      mimeType?: string;
      message?: {
        base64?: string;
        mimetype?: string;
      };
      data?: {
        base64?: string;
        mimetype?: string;
      };
    };
    const base64 =
      payload.base64 ??
      payload.data?.base64 ??
      payload.message?.base64 ??
      data.message?.imageMessage?.base64;
    const mimeType =
      payload.mimetype ??
      payload.mimeType ??
      payload.data?.mimetype ??
      payload.message?.mimetype ??
      data.message?.imageMessage?.mimetype ??
      'image/jpeg';

    if (!base64) {
      throw new Error('Evolution API returned empty base64 media');
    }

    return {
      buffer: Buffer.from(this.stripDataUrlPrefix(base64), 'base64'),
      mimeType
    };
  }

  private normalizeRecipient(remoteJid: string): string {
    return remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
  }

  private stripDataUrlPrefix(base64: string): string {
    return base64.replace(/^data:[^;]+;base64,/, '');
  }
}
