import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [UsersModule],
  controllers: [BillingController],
  providers: [BillingService, StripeService]
})
export class BillingModule {}
