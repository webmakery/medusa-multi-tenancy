import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import {
  activatePlatformAdminTenant,
  issueTenantAccessSessionCookie,
  resolveTenantUserAccess,
} from '../../_shared/tenant-user-access';

interface ActivateTenantBody {
  tenant_id?: string | null;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const access = await resolveTenantUserAccess(req);

  if (!access.actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  if (!access.isPlatformAdmin) {
    return res.status(403).json({ message: 'Only platform admins can activate tenant context.' });
  }

  const body = (req.body || {}) as ActivateTenantBody;
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : null;
  const normalizedTenantId = tenantId || null;

  try {
    const updated = await activatePlatformAdminTenant(req, normalizedTenantId);

    issueTenantAccessSessionCookie(req, res, {
      active_tenant_id: updated.active_tenant_id,
      tenant_role: updated.role,
      is_platform_admin: true,
    });

    return res.status(200).json({
      email: updated.user_email,
      is_platform_admin: updated.is_platform_admin,
      active_tenant_id: updated.active_tenant_id,
      tenant_id: updated.tenant_id,
    });
  } catch (error: any) {
    return res.status(error.status || 400).json({ message: error.message || 'Unable to activate tenant context.' });
  }
}
