import { forwardRef, Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { PlanModule } from '../common/plan/plan.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { EvolutionApiService } from './evolution-api.service';
import { OpenAiService } from './openai.service';
import { WhatsappParserService } from './parser/whatsapp-parser.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappImageQueueService } from './whatsapp-image-queue.service';
import { WhatsappQueueService } from './whatsapp-queue.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookGuardService } from './whatsapp-webhook-guard.service';

@Module({
  imports: [
    CategoriesModule,
    PlanModule,
    forwardRef(() => TransactionsModule),
    UsersModule
  ],
  controllers: [WhatsappController],
  providers: [
    EvolutionApiService,
    OpenAiService,
    WhatsappParserService,
    WhatsappImageQueueService,
    WhatsappQueueService,
    WhatsappService,
    WhatsappWebhookGuardService
  ],
  exports: [WhatsappQueueService]
})
export class WhatsappModule {}
