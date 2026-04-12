import { MedusaRequest } from '@medusajs/framework/http';

export function getTenantIdFromRequest(req: MedusaRequest): string | null {
  const fromHeader = req.headers['x-tenant-id'];

  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }

  const fromQuery = req.query?.tenant_id;

  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }

  return null;
}
