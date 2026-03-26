import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const port = Number(configService.get<string>('PORT', '3000'));

  await prismaService.enableShutdownHooks(app);
  app.enableCors();

  // Reserve a global prefix for future versioning/auth expansion when needed.
  // app.setGlobalPrefix('api');

  await app.listen(port);

  Logger.log(`Kontavo backend running on port ${port}`, 'Bootstrap');
}

void bootstrap();
