import { randomUUID } from 'crypto';

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { defineMiddlewares } from '@medusajs/framework/http';

import { tenantContextMiddleware, tenantContextStorage } from '../modules/tenant-context/middleware';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MUTATION_RATE_LIMIT_WINDOW_MS = 60_000;

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

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const tenantMutationRateLimitBuckets = new Map<string, RateLimitBucket>();

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
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

function tenantIpRateLimitMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const now = Date.now();
  rateLimitCleanup(now);

  const tenantId = tenantContextStorage.getStore()?.tenantId ?? 'system';
  const ip = getClientIp(req);
  const key = `${tenantId}:${ip}`;

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
  const bucketKey = `${tenantId}:${match.scope}:${req.method.toUpperCase()}`;
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

function structuredErrorLoggingMiddleware(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (res.statusCode < 400) {
      return;
    }

    const durationMs = Date.now() - startedAt;
    const tenantId = tenantContextStorage.getStore()?.tenantId ?? 'system';
    const correlationId = normalizeHeaderValue(req.headers[CORRELATION_ID_HEADER]);

    console.error(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : 'warn',
        event: 'api_response',
        statusCode: res.statusCode,
        method: req.method,
        path: req.originalUrl,
        tenantId,
        ip: getClientIp(req),
        correlationId,
        durationMs,
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
        tenantIpRateLimitMiddleware,
        tenantMutationRateLimitMiddleware,
        structuredErrorLoggingMiddleware,
      ],
    },
    {
      matcher: '*',
      middlewares: [
        requestCorrelationIdMiddleware,
        tenantContextMiddleware,
        tenantIpRateLimitMiddleware,
        tenantMutationRateLimitMiddleware,
        structuredErrorLoggingMiddleware,
      ],
    },
  ],
});
