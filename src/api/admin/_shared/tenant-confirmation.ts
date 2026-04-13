import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

interface TenantConfirmationOptions {
  tenantId: string;
  operationLabel: string;
}

export function requireTenantConfirmation(
  req: MedusaRequest,
  res: MedusaResponse,
  options: TenantConfirmationOptions
): boolean {
  const body = (req.body || {}) as { confirm_tenant_id?: string };
  const confirmationTenantId =
    body.confirm_tenant_id ||
    (typeof req.headers['x-confirm-tenant-id'] === 'string' ? req.headers['x-confirm-tenant-id'] : '');

  if (!confirmationTenantId) {
    res.status(428).json({
      message: `confirm_tenant_id is required to ${options.operationLabel}.`,
    });
    return false;
  }

  if (confirmationTenantId !== options.tenantId) {
    res.status(409).json({
      message: `Tenant confirmation mismatch. Confirmed tenant ${confirmationTenantId} does not match active tenant ${options.tenantId}.`,
    });
    return false;
  }

  return true;
}
