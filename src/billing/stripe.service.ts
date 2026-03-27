import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripeClient: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.stripeClient = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY')
    );
  }

  get client(): Stripe {
    return this.stripeClient;
  }

  getPriceIdForPlan(planType: PlanType): string {
    switch (planType) {
      case PlanType.ESSENTIAL:
        return this.configService.getOrThrow<string>('STRIPE_PRICE_ESSENTIAL');
      case PlanType.PREMIUM:
        return this.configService.getOrThrow<string>('STRIPE_PRICE_PREMIUM');
      case PlanType.FREE:
      default:
        throw new BadRequestException('FREE plan does not support checkout');
    }
  }

  resolvePlanTypeFromPriceId(priceId: string | null | undefined): PlanType {
    if (!priceId) {
      return PlanType.FREE;
    }

    if (priceId === this.configService.getOrThrow<string>('STRIPE_PRICE_ESSENTIAL')) {
      return PlanType.ESSENTIAL;
    }

    if (priceId === this.configService.getOrThrow<string>('STRIPE_PRICE_PREMIUM')) {
      return PlanType.PREMIUM;
    }

    throw new InternalServerErrorException('Unknown Stripe price mapping');
  }

  getSuccessUrl(): string {
    return this.configService.getOrThrow<string>('STRIPE_SUCCESS_URL');
  }

  getCancelUrl(): string {
    return this.configService.getOrThrow<string>('STRIPE_CANCEL_URL');
  }

  getPortalReturnUrl(): string {
    return this.configService.getOrThrow<string>('STRIPE_PORTAL_RETURN_URL');
  }

  getWebhookSecret(): string {
    return this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }
}
