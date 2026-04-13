const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantJobContext {
  tenant_id: string;
}

function normalizeTenantId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || !UUID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function extractTenantJobContext(payload: unknown): TenantJobContext | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const tenantId = normalizeTenantId((payload as { tenant_id?: unknown }).tenant_id);

  if (!tenantId) {
    return null;
  }

  return { tenant_id: tenantId };
}

export function requireTenantJobContext(payload: unknown, workerName: string): TenantJobContext {
  const context = extractTenantJobContext(payload);

  if (!context) {
    throw new Error(
      `Missing or invalid tenant context for worker "${workerName}". Jobs must carry a valid tenant_id.`
    );
  }

  return context;
}
