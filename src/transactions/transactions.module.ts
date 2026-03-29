import { forwardRef, Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { PlanModule } from '../common/plan/plan.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { UsersModule } from '../users/users.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsWhatsappNotifierService } from './transactions-whatsapp-notifier.service';

@Module({
  imports: [
    CategoriesModule,
    UsersModule,
    PlanModule,
    forwardRef(() => WhatsappModule)
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsWhatsappNotifierService],
  exports: [TransactionsService]
})
export class TransactionsModule {}
