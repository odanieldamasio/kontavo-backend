import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
const express = require('express');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const port = Number(configService.get<string>('PORT', '3000'));

  await prismaService.enableShutdownHooks(app);
  app.use('/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Jadeon Backend API')
    .setDescription('Documentacao da API do backend Jadeon')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument);

  // Reserve a global prefix for future versioning/auth expansion when needed.
  // app.setGlobalPrefix('api');

  await app.listen(port);

  Logger.log(`Jadeon backend running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger available at /docs`, 'Bootstrap');
}

void bootstrap();
