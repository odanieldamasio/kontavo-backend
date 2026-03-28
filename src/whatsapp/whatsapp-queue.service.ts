import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { Prisma, WhatsappMessageDirection } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EvolutionApiService } from './evolution-api.service';
import { WHATSAPP_OUTBOUND_QUEUE } from './constants/whatsapp.constants';

interface WhatsappOutboundJob {
  userId: string | null;
  remoteJid: string;
  text: string;
  rawPayload: Prisma.InputJsonValue;
}

@Injectable()
export class WhatsappQueueService implements OnModuleDestroy {
  private readonly queue: Queue<WhatsappOutboundJob>;
  private readonly worker: Worker<WhatsappOutboundJob>;

  constructor(
    configService: ConfigService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly prismaService: PrismaService
  ) {
    const connection = {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined
    };

    this.queue = new Queue<WhatsappOutboundJob>(WHATSAPP_OUTBOUND_QUEUE, {
      connection
    });

    this.worker = new Worker<WhatsappOutboundJob>(
      WHATSAPP_OUTBOUND_QUEUE,
      async (job) => this.processOutbound(job),
      {
        connection
      }
    );
  }

  async enqueueOutbound(job: WhatsappOutboundJob): Promise<void> {
    await this.queue.add('send-message', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  private async processOutbound(job: Job<WhatsappOutboundJob>): Promise<void> {
    await this.evolutionApiService.sendText(job.data.remoteJid, job.data.text);

    await this.prismaService.whatsappMessage.create({
      data: {
        userId: job.data.userId,
        transactionId: null,
        messageId: `outbound:${job.id}`,
        remoteJid: job.data.remoteJid,
        direction: WhatsappMessageDirection.OUTBOUND,
        text: job.data.text,
        parsed: true,
        rawPayload: job.data.rawPayload
      }
    });
  }
}
