import { MedusaRequest } from '@medusajs/framework/http';
import { getActiveTenantIdFromAuthContext } from '../admin/_shared/auth-context';

export function getTenantIdFromRequest(req: MedusaRequest): string | null {
  const fromHeader = req.headers['x-tenant-id'];

  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    const normalized = fromHeader.trim();
    if (normalized.toLowerCase() === 'system') {
      return null;
    }
    return normalized;
  }

  const fromQuery = req.query?.tenant_id;

  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    const normalized = fromQuery.trim();
    if (normalized.toLowerCase() === 'system') {
      return null;
    }
    return normalized;
  }

  const fromAuthContext = getActiveTenantIdFromAuthContext(req);

  if (fromAuthContext) {
    return fromAuthContext;
  }

  return null;
}
