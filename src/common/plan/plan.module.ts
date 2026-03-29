import { Module } from '@nestjs/common';
import { FeatureAccessGuard } from './guards/feature-access.guard';
import { PlanLimitGuard } from './guards/plan-limit.guard';
import { PlanService } from './plan.service';

@Module({
  providers: [PlanService, PlanLimitGuard, FeatureAccessGuard],
  exports: [PlanService, PlanLimitGuard, FeatureAccessGuard]
})
export class PlanModule {}
