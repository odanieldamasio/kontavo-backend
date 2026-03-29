import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PlanType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PLAN_LIMITS, PlanFeatureType, PlanLimitType } from './plan.constants';

type PlanErrorCode = 'LIMIT_REACHED' | 'FEATURE_NOT_AVAILABLE';

@Injectable()
export class PlanService {
  constructor(private readonly prismaService: PrismaService) {}

  getLimit(planType: PlanType, limitType: PlanLimitType): number {
    return PLAN_LIMITS[planType][limitType];
  }

  isUnlimited(value: number): boolean {
    return value === -1;
  }

  ensureWithinLimit(params: {
    planType: PlanType;
    limitType: PlanLimitType;
    currentCount: number;
    increment?: number;
    message?: string;
  }): void {
    const limit = this.getLimit(params.planType, params.limitType);

    if (this.isUnlimited(limit)) {
      return;
    }

    const projectedCount = params.currentCount + (params.increment ?? 0);

    if (projectedCount > limit) {
      this.throwForbidden(
        'LIMIT_REACHED',
        params.message ?? 'Limite atingido para o plano atual.'
      );
    }
  }

  async getUserPlanType(userId: string): Promise<PlanType> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { planType: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.planType;
  }

  async hasFeature(userId: string, featureKey: PlanFeatureType): Promise<boolean> {
    const planType = await this.getUserPlanType(userId);
    return PLAN_LIMITS[planType].features[featureKey];
  }

  async ensureFeatureAccess(
    userId: string,
    featureKey: PlanFeatureType,
    message?: string
  ): Promise<void> {
    const hasAccess = await this.hasFeature(userId, featureKey);

    if (!hasAccess) {
      this.throwForbidden(
        'FEATURE_NOT_AVAILABLE',
        message ?? 'Feature nao disponivel no plano atual.'
      );
    }
  }

  async getHistoryStartDateForUser(userId: string): Promise<Date | null> {
    const planType = await this.getUserPlanType(userId);
    return this.getHistoryStartDate(planType);
  }

  getHistoryStartDate(planType: PlanType, now = new Date()): Date | null {
    const historyMonths = this.getLimit(planType, 'historyMonths');

    if (this.isUnlimited(historyMonths)) {
      return null;
    }

    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - historyMonths);
    start.setUTCHours(0, 0, 0, 0);

    return start;
  }

  getMonthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);

    return { start, end };
  }

  throwForbidden(code: PlanErrorCode, message: string): never {
    throw new ForbiddenException({
      code,
      message
    });
  }
}
