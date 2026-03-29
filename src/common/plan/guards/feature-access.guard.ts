import {
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanType } from '@prisma/client';
import { PlanService } from '../plan.service';
import {
  REQUIRES_PLAN_KEY,
  RequiresPlanOptions
} from '../decorators/requires-plan.decorator';

const PLAN_WEIGHT: Record<PlanType, number> = {
  FREE: 0,
  ESSENTIAL: 1,
  PREMIUM: 2
};

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly planService: PlanService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RequiresPlanOptions>(
      REQUIRES_PLAN_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string };
    }>();
    const userId = request.user?.sub;

    if (!userId) {
      return true;
    }

    if (options.feature) {
      await this.planService.ensureFeatureAccess(userId, options.feature);
    }

    if (options.minimumPlanType) {
      const currentPlanType = await this.planService.getUserPlanType(userId);

      if (
        PLAN_WEIGHT[currentPlanType] <
        PLAN_WEIGHT[options.minimumPlanType]
      ) {
        this.planService.throwForbidden(
          'FEATURE_NOT_AVAILABLE',
          'Feature nao disponivel no plano atual.'
        );
      }
    }

    return true;
  }
}
