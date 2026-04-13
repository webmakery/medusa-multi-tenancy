export interface BillingPlanDefinition {
  code: string;
  trial_days: number;
  entitlements: Array<{
    feature_key: string;
    is_enabled: boolean;
    limit_value: number | null;
    meter_key?: string;
  }>;
}

export const BILLING_PLAN_DEFINITIONS: Record<string, BillingPlanDefinition> = {
  starter: {
    code: 'starter',
    trial_days: 14,
    entitlements: [
      {
        feature_key: 'apps.installations',
        is_enabled: true,
        limit_value: 5,
      },
      {
        feature_key: 'analytics.events',
        is_enabled: true,
        limit_value: 10000,
        meter_key: 'analytics.events',
      },
    ],
  },
};

export const DEFAULT_BILLING_PLAN_CODE = 'starter';
