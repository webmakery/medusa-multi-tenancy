import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { resolveTenantUserAccess } from '../../_shared/tenant-user-access';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const access = await resolveTenantUserAccess(req);

  if (!access.actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  return res.status(200).json({
    email: access.actorEmail,
    role: access.role,
    is_platform_admin: access.isPlatformAdmin,
    assigned_tenant_id: access.assignedTenantId,
    active_tenant_id: access.activeTenantId,
    effective_tenant_id: access.effectiveTenantId,
    is_auto_provisioned: access.autoProvisioned,
  });
}
