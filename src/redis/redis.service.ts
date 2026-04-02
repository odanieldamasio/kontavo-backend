import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2
    });
  }

  getClient(): Redis {
    return this.client;
  }

  private async ensureConnection(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async ping(): Promise<string> {
    await this.ensureConnection();

    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnection();

    return this.client.get(key);
  }

  async set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    await this.ensureConnection();

    if (ttlInSeconds) {
      await this.client.set(key, value, 'EX', ttlInSeconds);
      return;
    }

    await this.client.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.ensureConnection();
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
