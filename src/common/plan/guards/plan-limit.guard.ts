import {
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';
import { LIMIT_TYPE_KEY } from '../decorators/limit-type.decorator';
import { PlanLimitType } from '../plan.constants';
import { PlanService } from '../plan.service';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
    private readonly planService: PlanService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitType = this.reflector.getAllAndOverride<PlanLimitType>(
      LIMIT_TYPE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!limitType) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string };
      body?: { date?: string };
    }>();
    const userId = request.user?.sub;

    if (!userId) {
      return true;
    }

    const planType = await this.planService.getUserPlanType(userId);

    if (limitType === 'transactions') {
      const parsedDate = this.parseDateOrNow(request.body?.date);
      const monthRange = this.planService.getMonthRange(parsedDate);
      const currentCount = await this.prismaService.transaction.count({
        where: {
          userId,
          deletedAt: null,
          date: {
            gte: monthRange.start,
            lte: monthRange.end
          }
        }
      });

      this.planService.ensureWithinLimit({
        planType,
        limitType,
        currentCount,
        increment: 1,
        message: 'Limite de transacoes do plano atual atingido.'
      });

      return true;
    }

    if (limitType === 'categories') {
      const currentCount = await this.prismaService.category.count({
        where: {
          userId,
          deletedAt: null
        }
      });

      this.planService.ensureWithinLimit({
        planType,
        limitType,
        currentCount,
        increment: 1,
        message: 'Limite de categorias do plano atual atingido.'
      });
    }

    return true;
  }

  private parseDateOrNow(value: string | undefined): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }

    return parsed;
  }
}
