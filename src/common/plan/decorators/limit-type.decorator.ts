import { SetMetadata } from '@nestjs/common';
import { PlanLimitType } from '../plan.constants';

export const LIMIT_TYPE_KEY = 'plan:limit-type';

export const LimitType = (limitType: PlanLimitType) =>
  SetMetadata(LIMIT_TYPE_KEY, limitType);
