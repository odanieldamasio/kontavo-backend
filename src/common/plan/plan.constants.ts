import { PlanType } from '@prisma/client';

export const PLAN_LIMITS = {
  FREE: {
    transactions: 15,
    categories: 3,
    historyMonths: 1,
    features: {
      whatsapp: false,
      insights: false
    }
  },
  ESSENTIAL: {
    transactions: 150,
    categories: -1,
    historyMonths: 6,
    features: {
      whatsapp: true,
      insights: false
    }
  },
  PREMIUM: {
    transactions: 500,
    categories: -1,
    historyMonths: -1,
    features: {
      whatsapp: true,
      insights: true
    }
  }
} as const satisfies Record<PlanType, {
  transactions: number;
  categories: number;
  historyMonths: number;
  features: {
    whatsapp: boolean;
    insights: boolean;
  };
}>;

export type PlanLimitType = 'transactions' | 'categories' | 'historyMonths';
export type PlanFeatureType = keyof (typeof PLAN_LIMITS)[PlanType]['features'];
