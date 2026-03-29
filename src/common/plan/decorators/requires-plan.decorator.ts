import { SetMetadata } from '@nestjs/common';
import { PlanType } from '@prisma/client';
import { PlanFeatureType } from '../plan.constants';

export interface RequiresPlanOptions {
  feature?: PlanFeatureType;
  minimumPlanType?: PlanType;
}

export const REQUIRES_PLAN_KEY = 'plan:requires-plan';

export const RequiresPlan = (options: RequiresPlanOptions) =>
  SetMetadata(REQUIRES_PLAN_KEY, options);
