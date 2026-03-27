import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PlanType, Prisma, Subscription, User } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { BillingUrlResponseDto } from './dto/billing-url-response.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly stripeService: StripeService
  ) {}

  async createCheckoutSession(
    userId: string,
    dto: CreateCheckoutSessionDto
  ): Promise<BillingUrlResponseDto> {
    if (dto.planType === PlanType.FREE) {
      throw new BadRequestException('FREE plan does not support checkout');
    }

    const user = await this.getUserOrThrow(userId);
    const customerId = await this.getOrCreateCustomerId(user);
    const priceId = this.stripeService.getPriceIdForPlan(dto.planType);

    const session = await this.stripeService.client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      success_url: this.stripeService.getSuccessUrl(),
      cancel_url: this.stripeService.getCancelUrl(),
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        userId: user.id,
        planType: dto.planType
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planType: dto.planType
        }
      }
    });

    if (!session.url) {
      throw new BadRequestException('Unable to create checkout session');
    }

    return { url: session.url };
  }

  async createPortalSession(userId: string): Promise<BillingUrlResponseDto> {
    const user = await this.getUserOrThrow(userId);
    const customerId = await this.getOrCreateCustomerId(user);
    const session = await this.stripeService.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: this.stripeService.getPortalReturnUrl()
    });

    return { url: session.url };
  }

  constructWebhookEvent(signature: string | string[] | undefined, rawBody: Buffer): Stripe.Event {
    const resolvedSignature = Array.isArray(signature) ? signature[0] : signature;

    if (!resolvedSignature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    return this.stripeService.client.webhooks.constructEvent(
      rawBody,
      resolvedSignature,
      this.stripeService.getWebhookSecret()
    );
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        return;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        return;
      default:
        return;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.client_reference_id ?? session.metadata?.userId;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!userId || !subscriptionId) {
      return;
    }

    const subscription = await this.stripeService.client.subscriptions.retrieve(
      subscriptionId,
      {
        expand: ['items.data.price']
      }
    );

    await this.syncSubscriptionFromStripe(subscription, userId);
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = await this.resolveUserIdFromSubscription(subscription);

    if (!userId) {
      return;
    }

    await this.syncSubscriptionFromStripe(subscription, userId);
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = await this.resolveUserIdFromSubscription(subscription);

    if (!userId) {
      return;
    }

    const existing = await this.findSubscriptionRecord(subscription.id, subscription.customer);

    if (existing) {
      await this.prismaService.subscription.update({
        where: { id: existing.id },
        data: {
          status: subscription.status,
          planType: PlanType.FREE,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: this.toDate(this.getCurrentPeriodEnd(subscription)),
          stripePriceId: this.getStripePriceId(subscription)
        }
      });
    }

    await this.usersService.updatePlanType(userId, PlanType.FREE);
  }

  private async syncSubscriptionFromStripe(
    subscription: Stripe.Subscription,
    userId: string
  ): Promise<void> {
    const stripePriceId = this.getStripePriceId(subscription);
    const mappedPlanType = this.resolvePlanTypeForSubscription(
      subscription.status,
      stripePriceId
    );
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const existing = await this.prismaService.subscription.findUnique({
      where: { userId }
    });

    const data = {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      planType: mappedPlanType,
      status: subscription.status,
      currentPeriodEnd: this.toDate(this.getCurrentPeriodEnd(subscription)),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    };

    if (existing) {
      await this.prismaService.subscription.update({
        where: { userId },
        data
      });
    } else {
      await this.prismaService.subscription.create({
        data
      });
    }

    await this.usersService.updatePlanType(userId, mappedPlanType);
  }

  private async resolveUserIdFromSubscription(
    subscription: Stripe.Subscription
  ): Promise<string | null> {
    const metadataUserId = subscription.metadata?.userId;

    if (metadataUserId) {
      return metadataUserId;
    }

    const existing = await this.findSubscriptionRecord(
      subscription.id,
      subscription.customer
    );

    if (existing) {
      return existing.userId;
    }

    return null;
  }

  private async findSubscriptionRecord(
    stripeSubscriptionId: string,
    stripeCustomer: string | Stripe.Customer | Stripe.DeletedCustomer
  ): Promise<Subscription | null> {
    const bySubscriptionId = await this.prismaService.subscription.findFirst({
      where: { stripeSubscriptionId }
    });

    if (bySubscriptionId) {
      return bySubscriptionId;
    }

    const customerId =
      typeof stripeCustomer === 'string' ? stripeCustomer : stripeCustomer.id;

    return this.prismaService.subscription.findFirst({
      where: { stripeCustomerId: customerId }
    });
  }

  private async getOrCreateCustomerId(user: User): Promise<string> {
    const existing = await this.prismaService.subscription.findUnique({
      where: { userId: user.id }
    });

    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const customer = await this.stripeService.client.customers.create({
      email: user.email,
      name: user.name,
      phone: user.phone ?? undefined,
      metadata: {
        userId: user.id
      }
    });

    if (existing) {
      await this.prismaService.subscription.update({
        where: { userId: user.id },
        data: {
          stripeCustomerId: customer.id
        }
      });
    } else {
      await this.prismaService.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: customer.id,
          status: 'pending',
          planType: PlanType.FREE
        }
      });
    }

    return customer.id;
  }

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private resolvePlanTypeForSubscription(
    status: Stripe.Subscription.Status,
    stripePriceId: string | null
  ): PlanType {
    if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
      return PlanType.FREE;
    }

    return this.stripeService.resolvePlanTypeFromPriceId(stripePriceId);
  }

  private getStripePriceId(subscription: Stripe.Subscription): string | null {
    return subscription.items.data[0]?.price?.id ?? null;
  }

  private getCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
    const subscriptionWithPeriod = subscription as Stripe.Subscription & {
      current_period_end?: number;
    };

    return subscriptionWithPeriod.current_period_end ?? null;
  }

  private toDate(unixTimestamp: number | null | undefined): Date | null {
    if (!unixTimestamp) {
      return null;
    }

    return new Date(unixTimestamp * 1000);
  }
}
