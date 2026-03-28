import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { EvolutionApiService } from './evolution-api.service';
import { WhatsappParserService } from './parser/whatsapp-parser.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappQueueService } from './whatsapp-queue.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [CategoriesModule, TransactionsModule, UsersModule],
  controllers: [WhatsappController],
  providers: [
    EvolutionApiService,
    WhatsappParserService,
    WhatsappQueueService,
    WhatsappService
  ]
})
export class WhatsappModule {}
