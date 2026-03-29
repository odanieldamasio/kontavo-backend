import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EvolutionApiService,
  EvolutionWebhookConfiguration
} from './evolution-api.service';

interface WebhookValidation {
  valid: boolean;
  reason: string;
}

@Injectable()
export class WhatsappWebhookGuardService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappWebhookGuardService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly evolutionApiService: EvolutionApiService
  ) {}

  async onModuleInit(): Promise<void> {
    const isProduction =
      this.configService.get<string>('NODE_ENV', 'development') === 'production';
    const expectedWebhookUrl = this.configService.getOrThrow<string>(
      'EVOLUTION_WEBHOOK_URL'
    );

    try {
      const webhook = await this.evolutionApiService.findWebhookConfiguration();
      const validation = this.validateWebhook(webhook, expectedWebhookUrl);

      if (validation.valid) {
        this.logger.log(
          `Evolution webhook check passed (${expectedWebhookUrl})`
        );
        return;
      }

      const message = `Evolution webhook check failed: ${validation.reason}. Run "pnpm evolution:webhook:sync".`;

      if (isProduction) {
        this.logger.error(message);
        throw new Error(message);
      }

      this.logger.warn(message);
    } catch (error) {
      const message = `Evolution webhook check failed with request error: ${
        error instanceof Error ? error.message : 'unknown error'
      }. Run "pnpm evolution:webhook:sync".`;

      if (isProduction) {
        this.logger.error(message);
        throw error instanceof Error ? error : new Error(message);
      }

      this.logger.warn(message);
    }
  }

  private validateWebhook(
    webhook: EvolutionWebhookConfiguration | null,
    expectedWebhookUrl: string
  ): WebhookValidation {
    const normalized = this.normalizeWebhookPayload(webhook);

    if (!normalized) {
      return {
        valid: false,
        reason: 'webhook/find returned null or invalid payload'
      };
    }

    if (normalized.enabled !== true) {
      return {
        valid: false,
        reason: 'webhook is disabled'
      };
    }

    if (this.normalizeUrl(normalized.url) !== this.normalizeUrl(expectedWebhookUrl)) {
      return {
        valid: false,
        reason: `webhook URL mismatch (expected "${expectedWebhookUrl}", got "${normalized.url || 'empty'}")`
      };
    }

    const eventNames = normalized.events.map((event) => event.toUpperCase());

    if (!eventNames.includes('MESSAGES_UPSERT')) {
      return {
        valid: false,
        reason: 'webhook events does not contain MESSAGES_UPSERT'
      };
    }

    return {
      valid: true,
      reason: 'ok'
    };
  }

  private normalizeWebhookPayload(
    webhook: EvolutionWebhookConfiguration | null
  ): { enabled: boolean; url: string; events: string[] } | null {
    if (!webhook || typeof webhook !== 'object') {
      return null;
    }

    const candidate = webhook.webhook ?? webhook;
    const enabled = candidate.enabled === true;
    const url = typeof candidate.url === 'string' ? candidate.url : '';
    const events = Array.isArray(candidate.events)
      ? candidate.events.filter((event): event is string => typeof event === 'string')
      : [];

    return {
      enabled,
      url,
      events
    };
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
  }
}
