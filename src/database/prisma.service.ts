import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private isShuttingDown = false;

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    const shutdown = async (): Promise<void> => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      await app.close();
    };

    process.once('SIGINT', () => {
      void shutdown();
    });

    process.once('SIGTERM', () => {
      void shutdown();
    });
  }
}
