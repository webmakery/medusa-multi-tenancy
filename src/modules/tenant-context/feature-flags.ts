import { createHash } from 'crypto';

export type ReleaseStrategy = 'disabled' | 'all' | 'canary' | 'blue-green';

export interface TenantFlagRule {
  enabled?: boolean;
  strategy?: ReleaseStrategy;
  canary_percentage?: number;
  blue_environment?: 'blue' | 'green';
}

export interface FeatureFlagDefinition {
  default_enabled?: boolean;
  strategy?: ReleaseStrategy;
  canary_percentage?: number;
  blue_environment?: 'blue' | 'green';
  tenants?: Record<string, TenantFlagRule>;
}

export type FeatureFlagRegistry = Record<string, FeatureFlagDefinition>;

function stablePercent(seed: string): number {
  const hash = createHash('sha256').update(seed).digest('hex');
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % 100;
  return bucket;
}

function normalizePercentage(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function resolveRule(flag: FeatureFlagDefinition, tenantId: string): Required<TenantFlagRule> {
  const tenantRule = flag.tenants?.[tenantId] || {};
  const enabled = tenantRule.enabled ?? flag.default_enabled ?? false;
  const strategy = tenantRule.strategy ?? flag.strategy ?? (enabled ? 'all' : 'disabled');

  return {
    enabled,
    strategy,
    canary_percentage: normalizePercentage(tenantRule.canary_percentage ?? flag.canary_percentage),
    blue_environment: tenantRule.blue_environment ?? flag.blue_environment ?? 'blue',
  };
}

export function getFeatureFlagRegistryFromEnv(): FeatureFlagRegistry {
  const source = process.env.TENANT_FEATURE_FLAGS;

  if (!source) {
    return {};
  }

  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isFeatureEnabledForTenant(input: {
  registry?: FeatureFlagRegistry;
  flag: string;
  tenantId: string;
  subjectId?: string;
  targetEnvironment?: 'blue' | 'green';
}): boolean {
  const registry = input.registry ?? getFeatureFlagRegistryFromEnv();
  const flagDefinition = registry[input.flag];

  if (!flagDefinition) {
    return false;
  }

  const rule = resolveRule(flagDefinition, input.tenantId);

  if (!rule.enabled || rule.strategy === 'disabled') {
    return false;
  }

  if (rule.strategy === 'all') {
    return true;
  }

  if (rule.strategy === 'blue-green') {
    return !input.targetEnvironment || input.targetEnvironment === rule.blue_environment;
  }

  if (rule.strategy === 'canary') {
    const identity = input.subjectId || input.tenantId;
    return stablePercent(`${input.flag}:${input.tenantId}:${identity}`) < rule.canary_percentage;
  }

  return false;
}
