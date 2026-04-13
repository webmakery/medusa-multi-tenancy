import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { defineMiddlewares } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { getActiveTenantIdFromAuthContext, getActorEmail } from './admin/_shared/auth-context';
import {
  buildTenantScopedKey,
  purgeTenantEntriesFromMap,
  purgeTenantEntriesFromSet,
  registerTenantRuntimeInvalidator,
} from '../modules/tenant-context/runtime-state';
import { tenantContextMiddleware, tenantContextStorage } from '../modules/tenant-context/middleware';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MUTATION_RATE_LIMIT_WINDOW_MS = 60_000;
const QUOTA_WINDOW_MS = 60 * 60 * 1000;
const ABUSE_WINDOW_MS = 60_000;
const ABUSE_ERROR_WINDOW_MS = 5 * 60 * 1000;
const PLATFORM_OPERATOR_AUTH_METADATA_KEYS = ['platform_operator', 'is_platform_operator', 'is_admin', 'admin'] as const;

const TENANT_SAFE_APP_ROUTE_PATTERNS: RegExp[] = [
  /^\/app\/login\/?$/i,
  /^\/app\/invite\/?$/i,
  /^\/app\/reset-password\/?$/i,
  /^\/app\/analytics\/?$/i,
  /^\/app\/apps\/?$/i,
  /^\/app\/billing\/?$/i,
  /^\/app\/onboarding-status\/?$/i,
  /^\/app\/order-operations\/?$/i,
  /^\/app\/sales-channels\/?$/i,
  /^\/app\/store-settings\/?$/i,
  /^\/app\/team-members\/?$/i,
];

const TENANT_SAFE_ADMIN_ROUTE_PATTERNS: RegExp[] = [
  /^\/admin\/auth\//i,
  /^\/admin\/analytics\//i,
  /^\/admin\/apps\//i,
  /^\/admin\/billing\/status\/?$/i,
  /^\/admin\/collections\/batch\/?$/i,
  /^\/admin\/inventory\/batch\/?$/i,
  /^\/admin\/onboarding-checklist\/?$/i,
  /^\/admin\/orders\//i,
  /^\/admin\/payments\/?$/i,
  /^\/admin\/products\/batch\/?$/i,
  /^\/admin\/sales-channels\//i,
  /^\/admin\/settings\/store\/?$/i,
  /^\/admin\/team-members\/?$/i,
  /^\/admin\/tenants\/active\/?$/i,
  /^\/admin\/tenants\/invitations\/accept\/?$/i,
  /^\/admin\/tenants\/[^/]+\//i,
  /^\/admin\/themes\//i,
];

type EndpointClass = 'auth' | 'write-heavy' | 'reporting' | 'api-exports';

type EndpointClassQuotaConfig = {
  throttlePerMinute: number;
  softQuotaPerHour: number;
  hardQuotaPerHour: number;
  alertThresholdRatio: number;
  overageGraceRequests: number;
};

const ENDPOINT_CLASS_LIMITS: Record<EndpointClass, EndpointClassQuotaConfig> = {
  auth: {
    throttlePerMinute: 60,
    softQuotaPerHour: 600,
    hardQuotaPerHour: 750,
    alertThresholdRatio: 0.8,
    overageGraceRequests: 25,
  },
  'write-heavy': {
    throttlePerMinute: 180,
    softQuotaPerHour: 2_500,
    hardQuotaPerHour: 3_000,
    alertThresholdRatio: 0.8,
    overageGraceRequests: 100,
  },
  reporting: {
    throttlePerMinute: 90,
    softQuotaPerHour: 800,
    hardQuotaPerHour: 1_000,
    alertThresholdRatio: 0.75,
    overageGraceRequests: 40,
  },
  'api-exports': {
    throttlePerMinute: 20,
    softQuotaPerHour: 120,
    hardQuotaPerHour: 160,
    alertThresholdRatio: 0.7,
    overageGraceRequests: 10,
  },
};

type TenantClassOverride = Partial<
  Pick<EndpointClassQuotaConfig, 'throttlePerMinute' | 'softQuotaPerHour' | 'hardQuotaPerHour' | 'overageGraceRequests'>
>;

type MutationLimitConfig = {
  method: string;
  pathRegex: RegExp;
  maxRequests: number;
  scope: string;
};

const TENANT_MUTATION_RATE_LIMITS: MutationLimitConfig[] = [
  {
    method: 'POST',
    pathRegex: /^\/store\/checkout\/?$/i,
    maxRequests: 30,
    scope: 'checkout',
  },
  {
    method: 'POST',
    pathRegex: /^\/admin\/apps\/?$/i,
    maxRequests: 20,
    scope: 'app-install',
  },
  {
    method: 'POST',
    pathRegex: /^\/admin\/tenants\/[^/]+\/invite\/?$/i,
    maxRequests: 20,
    scope: 'tenant-invite',
  },
  {
    method: 'POST',
    pathRegex: /^\/admin\/orders\/[^/]+\/(refunds|returns|fulfillments)\/?$/i,
    maxRequests: 60,
    scope: 'order-mutation',
  },
  {
    method: 'POST',
    pathRegex: /^\/admin\/orders\/[^/]+\/fulfillments\/[^/]+\/tracking\/?$/i,
    maxRequests: 60,
    scope: 'order-mutation',
  },
];

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RollingUsageBucket = {
  count: number;
  resetAt: number;
};

type AbuseSpikeBucket = {
  count: number;
  previousCount: number;
  resetAt: number;
};

type ErrorRateBucket = {
  total: number;
  errors: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const tenantMutationRateLimitBuckets = new Map<string, RateLimitBucket>();
const tenantEndpointClassBuckets = new Map<string, RateLimitBucket>();
const tenantEndpointClassQuotaBuckets = new Map<string, RollingUsageBucket>();
const tenantEndpointClassAbuseBuckets = new Map<string, AbuseSpikeBucket>();
const tenantErrorRateBuckets = new Map<string, ErrorRateBucket>();
const quotaAlertDeduplication = new Set<string>();
const abuseAlertDeduplication = new Set<string>();
const potentialLeakageDeduplication = new Set<string>();
const actorTenantPatternWindow = new Map<string, { tenantId: string; updatedAt: number }>();
const LEAKAGE_PATTERN_WINDOW_MS = 2 * 60 * 1000;

registerTenantRuntimeInvalidator((tenantId: string) => {
  purgeTenantEntriesFromMap(rateLimitBuckets, tenantId);
  purgeTenantEntriesFromMap(tenantMutationRateLimitBuckets, tenantId);
  purgeTenantEntriesFromMap(tenantEndpointClassBuckets, tenantId);
  purgeTenantEntriesFromMap(tenantEndpointClassQuotaBuckets, tenantId);
  purgeTenantEntriesFromMap(tenantEndpointClassAbuseBuckets, tenantId);
  purgeTenantEntriesFromMap(tenantErrorRateBuckets, tenantId);
  purgeTenantEntriesFromSet(quotaAlertDeduplication, tenantId);
  purgeTenantEntriesFromSet(abuseAlertDeduplication, tenantId);
  purgeTenantEntriesFromSet(potentialLeakageDeduplication, tenantId);
});

function pseudonymize(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return `h_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parseTenantLimitOverrides(): Record<string, Partial<Record<EndpointClass, TenantClassOverride>>> {
  const rawValue = process.env.TENANT_LIMIT_OVERRIDES;

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        event: 'tenant_limit_override_parse_failed',
        message: 'Ignoring invalid TENANT_LIMIT_OVERRIDES JSON.',
      })
    );
  }

  return {};
}

const tenantLimitOverrides = parseTenantLimitOverrides();

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isTruthy(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function hasBasicApiKeyAuth(req: MedusaRequest): boolean {
  const authorization = normalizeHeaderValue(req.headers.authorization)?.trim();
  return Boolean(authorization && authorization.toLowerCase().startsWith('basic '));
}

function isPlatformOperator(req: MedusaRequest): boolean {
  if (hasBasicApiKeyAuth(req)) {
    return true;
  }

  const authContext = (req as any).auth_context;

  for (const key of PLATFORM_OPERATOR_AUTH_METADATA_KEYS) {
    if (isTruthy(authContext?.app_metadata?.[key]) || isTruthy(authContext?.auth_identity?.app_metadata?.[key])) {
      return true;
    }
  }

  const operatorHeader = normalizeHeaderValue(req.headers['x-platform-operator']);
  return isTruthy(operatorHeader);
}

function getPathname(req: MedusaRequest): string {
  return (req.path || req.originalUrl || '').split('?')[0] || '/';
}

function isHtmlRequest(req: MedusaRequest): boolean {
  const accept = normalizeHeaderValue(req.headers.accept)?.toLowerCase() || '';
  const fetchDest = normalizeHeaderValue(req.headers['sec-fetch-dest'])?.toLowerCase() || '';

  return accept.includes('text/html') || fetchDest === 'document';
}

function isAppStaticAssetRequest(pathname: string): boolean {
  if (!pathname.startsWith('/app/')) {
    return false;
  }

  return /\.[a-z0-9]+$/i.test(pathname);
}

function isTenantSafeAppPath(pathname: string): boolean {
  return TENANT_SAFE_APP_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isTenantSafeAdminPath(pathname: string): boolean {
  return TENANT_SAFE_ADMIN_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

async function hasActiveTenantMembership(req: MedusaRequest, email: string): Promise<boolean> {
  const knex = req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;

  if (!knex) {
    return false;
  }

  const membership = await knex('tenant_membership')
    .select('id')
    .where({ user_email: email, status: 'active' })
    .first();

  return Boolean(membership?.id);
}

async function tenantAdminSurfaceContainmentMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const actorEmail = getActorEmail(req);

  if (!actorEmail || isPlatformOperator(req)) {
    return next();
  }

  const isTenantDashboardUser = await hasActiveTenantMembership(req, actorEmail);

  if (!isTenantDashboardUser) {
    return next();
  }

  const pathname = getPathname(req);

  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (!isHtmlRequest(req) || isAppStaticAssetRequest(pathname)) {
      return next();
    }

    if (!isTenantSafeAppPath(pathname)) {
      return res.redirect(302, '/app/onboarding-status');
    }

    return next();
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!isTenantSafeAdminPath(pathname)) {
      return res.status(403).json({
        message: 'Access denied: this admin route is restricted to platform operators.',
      });
    }
  }

  return next();
}

function parseTraceParent(traceParentHeader: string | undefined): { trace_id?: string; span_id?: string } {
  if (!traceParentHeader) {
    return {};
  }

  const match = traceParentHeader.trim().match(/^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i);

  if (!match) {
    return {};
  }

  return {
    trace_id: match[1],
    span_id: match[2],
  };
}

function getClientIp(req: MedusaRequest): string {
  const forwardedFor = normalizeHeaderValue(req.headers['x-forwarded-for']);

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip ?? 'unknown';
}

function requestCorrelationIdMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const incomingCorrelationId = normalizeHeaderValue(req.headers[CORRELATION_ID_HEADER]);
  const correlationId = incomingCorrelationId?.trim() || randomUUID();

  req.headers[CORRELATION_ID_HEADER] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}

function rateLimitCleanup(now: number) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }

  for (const [key, bucket] of tenantMutationRateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      tenantMutationRateLimitBuckets.delete(key);
    }
  }

  for (const [key, bucket] of tenantEndpointClassBuckets.entries()) {
    if (bucket.resetAt <= now) {
      tenantEndpointClassBuckets.delete(key);
    }
  }

  for (const [key, bucket] of tenantEndpointClassQuotaBuckets.entries()) {
    if (bucket.resetAt <= now) {
      tenantEndpointClassQuotaBuckets.delete(key);
      quotaAlertDeduplication.delete(key);
    }
  }

  for (const [key, bucket] of tenantEndpointClassAbuseBuckets.entries()) {
    if (bucket.resetAt <= now) {
      tenantEndpointClassAbuseBuckets.delete(key);
      abuseAlertDeduplication.delete(key);
    }
  }

  for (const [key, bucket] of tenantErrorRateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      tenantErrorRateBuckets.delete(key);
    }
  }

  for (const [key, value] of actorTenantPatternWindow.entries()) {
    if (value.updatedAt + LEAKAGE_PATTERN_WINDOW_MS <= now) {
      actorTenantPatternWindow.delete(key);
    }
  }
}

function getTenantRateLimitIdentity(req: MedusaRequest): string {
  const tenantFromContext = tenantContextStorage.getStore()?.tenantId;
  if (tenantFromContext?.trim()) {
    return tenantFromContext.trim();
  }

  const tenantHeader = normalizeHeaderValue(req.headers['x-tenant-id']);
  if (tenantHeader?.trim()) {
    return tenantHeader.trim();
  }

  const tenantParam = ((req.params as Record<string, string | undefined>)?.tenant_id || '').trim();
  if (tenantParam) {
    return tenantParam;
  }

  return 'system';
}

function classifyEndpoint(req: MedusaRequest): EndpointClass {
  const pathname = (req.path || req.originalUrl || '').split('?')[0].toLowerCase();
  const method = req.method.toUpperCase();

  if (
    pathname.includes('/auth') ||
    pathname.includes('/login') ||
    pathname.includes('/signup') ||
    pathname.includes('/password') ||
    pathname.includes('/token')
  ) {
    return 'auth';
  }

  if (
    pathname.includes('/export') ||
    pathname.includes('/exports') ||
    pathname.includes('/download')
  ) {
    return 'api-exports';
  }

  if (
    pathname.includes('/analytics') ||
    pathname.includes('/report') ||
    pathname.includes('/timeseries') ||
    pathname.includes('/top-products')
  ) {
    return 'reporting';
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'write-heavy';
  }

  return 'reporting';
}

function getLimitConfig(tenantId: string, endpointClass: EndpointClass): EndpointClassQuotaConfig {
  const base = ENDPOINT_CLASS_LIMITS[endpointClass];
  const override = tenantLimitOverrides?.[tenantId]?.[endpointClass] ?? {};

  return {
    ...base,
    ...override,
  };
}

function tenantIpRateLimitMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const now = Date.now();
  rateLimitCleanup(now);

  const tenantId = tenantContextStorage.getStore()?.tenantId ?? 'system';
  const ip = getClientIp(req);
  const key = buildTenantScopedKey(tenantId, 'ip-rate-limit', ip);

  const existingBucket = rateLimitBuckets.get(key);

  if (!existingBucket || existingBucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (existingBucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existingBucket.resetAt - now) / 1000));

    res.setHeader('retry-after', retryAfterSeconds.toString());

    return res.status(429).json({
      message: 'Too many requests for this tenant and IP. Please retry later.',
    });
  }

  existingBucket.count += 1;
  next();
}

function tenantMutationRateLimitMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const pathname = (req.path || req.originalUrl || '').split('?')[0];
  const match = TENANT_MUTATION_RATE_LIMITS.find(
    (config) => config.method === req.method.toUpperCase() && config.pathRegex.test(pathname)
  );

  if (!match) {
    return next();
  }

  const now = Date.now();
  rateLimitCleanup(now);

  const tenantId = getTenantRateLimitIdentity(req);
  const bucketKey = buildTenantScopedKey(tenantId, 'mutation-rate-limit', match.scope, req.method.toUpperCase());
  const existingBucket = tenantMutationRateLimitBuckets.get(bucketKey);

  if (!existingBucket || existingBucket.resetAt <= now) {
    tenantMutationRateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + MUTATION_RATE_LIMIT_WINDOW_MS,
    });

    return next();
  }

  if (existingBucket.count >= match.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existingBucket.resetAt - now) / 1000));

    res.setHeader('retry-after', retryAfterSeconds.toString());

    return res.status(429).json({
      message: `Too many ${match.scope} requests for this tenant. Please retry later.`,
    });
  }

  existingBucket.count += 1;
  return next();
}

function tenantEndpointClassRateLimitAndQuotaMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const now = Date.now();
  rateLimitCleanup(now);

  const tenantId = getTenantRateLimitIdentity(req);
  const endpointClass = classifyEndpoint(req);
  const classConfig = getLimitConfig(tenantId, endpointClass);
  const throttleKey = buildTenantScopedKey(tenantId, endpointClass, 'throttle');

  const throttleBucket = tenantEndpointClassBuckets.get(throttleKey);
  if (!throttleBucket || throttleBucket.resetAt <= now) {
    tenantEndpointClassBuckets.set(throttleKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    if (throttleBucket.count >= classConfig.throttlePerMinute) {
      const retryAfterSeconds = Math.max(1, Math.ceil((throttleBucket.resetAt - now) / 1000));
      res.setHeader('retry-after', retryAfterSeconds.toString());

      return res.status(429).json({
        message: `Throttle exceeded for ${endpointClass} requests on this tenant.`,
        tenant_id: tenantId,
        endpoint_class: endpointClass,
      });
    }

    throttleBucket.count += 1;
  }

  const quotaKey = buildTenantScopedKey(tenantId, endpointClass, 'quota');
  const quotaBucket = tenantEndpointClassQuotaBuckets.get(quotaKey);
  let usageCount = 1;
  let quotaResetAt = now + QUOTA_WINDOW_MS;

  if (!quotaBucket || quotaBucket.resetAt <= now) {
    tenantEndpointClassQuotaBuckets.set(quotaKey, {
      count: usageCount,
      resetAt: quotaResetAt,
    });
  } else {
    quotaBucket.count += 1;
    usageCount = quotaBucket.count;
    quotaResetAt = quotaBucket.resetAt;
  }

  const alertThreshold = Math.ceil(classConfig.softQuotaPerHour * classConfig.alertThresholdRatio);
  const hardWithOverage = classConfig.hardQuotaPerHour + classConfig.overageGraceRequests;

  const quotaAlertKey = buildTenantScopedKey(tenantId, endpointClass, 'quota', 'alert');

  if (usageCount >= alertThreshold && !quotaAlertDeduplication.has(quotaAlertKey)) {
    quotaAlertDeduplication.add(quotaAlertKey);
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'tenant_usage_alert_threshold_reached',
        tenant_id: tenantId,
        endpoint_class: endpointClass,
        usage_count: usageCount,
        alert_threshold: alertThreshold,
        soft_quota: classConfig.softQuotaPerHour,
        hard_quota: classConfig.hardQuotaPerHour,
      })
    );
  }

  if (usageCount > classConfig.softQuotaPerHour) {
    res.setHeader('x-usage-quota-state', 'soft-limit-overage');
    res.setHeader('x-usage-quota-soft-limit', classConfig.softQuotaPerHour.toString());
    res.setHeader('x-usage-quota-hard-limit', classConfig.hardQuotaPerHour.toString());
    res.setHeader('x-usage-overage-grace', classConfig.overageGraceRequests.toString());
  }

  if (usageCount > classConfig.hardQuotaPerHour && usageCount <= hardWithOverage) {
    res.setHeader('x-usage-quota-state', 'hard-limit-overage-grace');
  }

  if (usageCount > hardWithOverage) {
    const retryAfterSeconds = Math.max(1, Math.ceil((quotaResetAt - now) / 1000));
    res.setHeader('retry-after', retryAfterSeconds.toString());

    return res.status(429).json({
      message: `Hard quota exceeded for ${endpointClass} requests on this tenant.`,
      tenant_id: tenantId,
      endpoint_class: endpointClass,
      soft_quota_per_hour: classConfig.softQuotaPerHour,
      hard_quota_per_hour: classConfig.hardQuotaPerHour,
      overage_grace_requests: classConfig.overageGraceRequests,
      retry_after_seconds: retryAfterSeconds,
    });
  }

  const abuseKey = buildTenantScopedKey(tenantId, endpointClass, 'abuse');
  const abuseBucket = tenantEndpointClassAbuseBuckets.get(abuseKey);

  if (!abuseBucket || abuseBucket.resetAt <= now) {
    tenantEndpointClassAbuseBuckets.set(abuseKey, {
      count: 1,
      previousCount: abuseBucket?.count ?? 0,
      resetAt: now + ABUSE_WINDOW_MS,
    });
  } else {
    abuseBucket.count += 1;
    const spikeThreshold = Math.max(25, abuseBucket.previousCount * 3);

    if (abuseBucket.count >= spikeThreshold && !abuseAlertDeduplication.has(abuseKey)) {
      abuseAlertDeduplication.add(abuseKey);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'tenant_abuse_sudden_spike',
          tenant_id: tenantId,
          endpoint_class: endpointClass,
          current_window_count: abuseBucket.count,
          previous_window_count: abuseBucket.previousCount,
          spike_threshold: spikeThreshold,
        })
      );
    }
  }

  return next();
}

function structuredErrorLoggingMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const tenantId = getTenantRateLimitIdentity(req);
    const endpointClass = classifyEndpoint(req);
    const now = Date.now();
    const errorRateKey = buildTenantScopedKey(tenantId, endpointClass, 'error-rate');
    const errorRateBucket = tenantErrorRateBuckets.get(errorRateKey);

    if (!errorRateBucket || errorRateBucket.resetAt <= now) {
      tenantErrorRateBuckets.set(errorRateKey, {
        total: 1,
        errors: res.statusCode >= 400 ? 1 : 0,
        resetAt: now + ABUSE_ERROR_WINDOW_MS,
      });
    } else {
      errorRateBucket.total += 1;
      if (res.statusCode >= 400) {
        errorRateBucket.errors += 1;
      }

      if (errorRateBucket.total >= 20) {
        const errorRate = errorRateBucket.errors / errorRateBucket.total;
        if (errorRate >= 0.35) {
          console.error(
            JSON.stringify({
              level: 'error',
              event: 'tenant_abuse_high_error_rate',
              tenant_id: tenantId,
              endpoint_class: endpointClass,
              window_total_requests: errorRateBucket.total,
              window_errored_requests: errorRateBucket.errors,
              error_rate: errorRate,
            })
          );
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    const correlationId = normalizeHeaderValue(req.headers[CORRELATION_ID_HEADER]);
    const traceParent = normalizeHeaderValue(req.headers.traceparent);
    const traceContext = parseTraceParent(traceParent);
    const actorHash = pseudonymize(getActorEmail(req));
    const clientIpHash = pseudonymize(getClientIp(req));
    const authTenantId = getActiveTenantIdFromAuthContext(req);
    const pathname = (req.path || req.originalUrl || '').split('?')[0];

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'tenant_metric_http_request',
        tenant_id: tenantId,
        endpoint_class: endpointClass,
        method: req.method,
        path: pathname,
        status_code: res.statusCode,
        duration_ms: durationMs,
        correlation_id: correlationId,
        actor_hash: actorHash,
        ip_hash: clientIpHash,
        ...traceContext,
      })
    );

    if (authTenantId && authTenantId !== tenantId) {
      const authMismatchKey = buildTenantScopedKey(tenantId, 'auth-mismatch', actorHash || 'unknown', authTenantId);
      if (!potentialLeakageDeduplication.has(authMismatchKey)) {
        potentialLeakageDeduplication.add(authMismatchKey);
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'tenant_leakage_auth_mismatch',
            tenant_id: tenantId,
            auth_tenant_id: authTenantId,
            endpoint_class: endpointClass,
            correlation_id: correlationId,
            actor_hash: actorHash,
            ...traceContext,
          })
        );
      }
    }

    if (actorHash) {
      const priorPattern = actorTenantPatternWindow.get(actorHash);
      if (priorPattern && priorPattern.tenantId !== tenantId && now - priorPattern.updatedAt <= LEAKAGE_PATTERN_WINDOW_MS) {
        const crossTenantKey = buildTenantScopedKey(tenantId, 'cross-tenant-pattern', actorHash, priorPattern.tenantId);
        if (!potentialLeakageDeduplication.has(crossTenantKey)) {
          potentialLeakageDeduplication.add(crossTenantKey);
          console.warn(
            JSON.stringify({
              level: 'warn',
              event: 'tenant_leakage_cross_tenant_pattern',
              tenant_id: tenantId,
              previous_tenant_id: priorPattern.tenantId,
              endpoint_class: endpointClass,
              correlation_id: correlationId,
              actor_hash: actorHash,
              ...traceContext,
            })
          );
        }
      }
      actorTenantPatternWindow.set(actorHash, { tenantId, updatedAt: now });
    }

    if (res.statusCode < 400) {
      return;
    }

    console.error(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : 'warn',
        event: 'api_response',
        status_code: res.statusCode,
        method: req.method,
        path: pathname,
        tenant_id: tenantId,
        endpoint_class: endpointClass,
        ip_hash: clientIpHash,
        correlation_id: correlationId,
        duration_ms: durationMs,
        actor_hash: actorHash,
        ...traceContext,
      })
    );
  });

  next();
}

export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/apps/webhooks/*',
      middlewares: [
        requestCorrelationIdMiddleware,
        tenantContextMiddleware,
        tenantAdminSurfaceContainmentMiddleware,
        tenantIpRateLimitMiddleware,
        tenantMutationRateLimitMiddleware,
        tenantEndpointClassRateLimitAndQuotaMiddleware,
        structuredErrorLoggingMiddleware,
      ],
    },
    {
      matcher: '*',
      middlewares: [
        requestCorrelationIdMiddleware,
        tenantContextMiddleware,
        tenantAdminSurfaceContainmentMiddleware,
        tenantIpRateLimitMiddleware,
        tenantMutationRateLimitMiddleware,
        tenantEndpointClassRateLimitAndQuotaMiddleware,
        structuredErrorLoggingMiddleware,
      ],
    },
  ],
});
