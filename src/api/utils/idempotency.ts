import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from './tenant';

export function getIdempotencyKey(req: MedusaRequest): string | null {
  const value = req.headers['idempotency-key'];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && value[0]?.trim()) {
    return value[0].trim();
  }

  return null;
}

export function requireIdempotencyKey(req: MedusaRequest, res: MedusaResponse): string | null {
  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    res.status(400).json({
      message: 'idempotency-key header is required',
    });

    return null;
  }

  return idempotencyKey;
}

export function buildTenantScopedIdempotencyKey(req: MedusaRequest, baseScope: string, idempotencyKey: string): string {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    throw new Error('x-tenant-id header (or tenant_id query in development) is required');
  }

  return `${baseScope}:tenant:${tenantId}:${idempotencyKey}`;
}
