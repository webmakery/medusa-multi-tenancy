import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { assignUserToTenant, resolveTenantUserAccess } from '../../_shared/tenant-user-access';

interface AssignTenantBody {
  user_email?: string;
  tenant_id?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const access = await resolveTenantUserAccess(req);

  if (!access.actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  if (!access.isPlatformAdmin) {
    return res.status(403).json({ message: 'Only platform admins can assign users to tenants.' });
  }

  const body = (req.body || {}) as AssignTenantBody;

  if (!body.user_email?.trim()) {
    return res.status(400).json({ message: 'user_email is required' });
  }

  if (!body.tenant_id?.trim()) {
    return res.status(400).json({ message: 'tenant_id is required' });
  }

  try {
    const assignment = await assignUserToTenant(req, {
      user_email: body.user_email,
      tenant_id: body.tenant_id,
    });

    return res.status(200).json({ assignment });
  } catch (error: any) {
    return res.status(error.status || 400).json({ message: error.message || 'Unable to assign tenant access.' });
  }
}
