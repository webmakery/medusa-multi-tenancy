import { MedusaRequest } from '@medusajs/framework/http';
import { getActiveTenantIdFromAuthContext } from '../admin/_shared/auth-context';

export function getTenantIdFromRequest(req: MedusaRequest): string | null {
  const fromHeader = req.headers['x-tenant-id'];

  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }

  const fromQuery = req.query?.tenant_id;

  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }

  const fromAuthContext = getActiveTenantIdFromAuthContext(req);

  if (fromAuthContext) {
    return fromAuthContext;
  }

  return null;
}
