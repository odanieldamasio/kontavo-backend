import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const port = Number(configService.get<string>('PORT', '3000'));

  await prismaService.enableShutdownHooks(app);
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kontavo Backend API')
    .setDescription('Documentacao da API do backend Kontavo')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument);

  // Reserve a global prefix for future versioning/auth expansion when needed.
  // app.setGlobalPrefix('api');

  await app.listen(port);

  Logger.log(`Kontavo backend running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger available at /docs`, 'Bootstrap');
}

void bootstrap();
