import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';

interface InviteBody {
  email?: string;
  role?: 'owner' | 'admin' | 'staff';
  invited_by?: string;
  expires_in_days?: number;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const body = (req.body || {}) as InviteBody;
  const { tenant_id } = req.params;

  if (!body.email?.trim()) {
    return res.status(400).json({ message: 'email is required' });
  }

  const invitation = await tenantManagementService.inviteUserToTenant({
    tenant_id,
    email: body.email,
    role: body.role,
    invited_by: body.invited_by,
    expires_in_days: body.expires_in_days,
  });

  return res.status(201).json({ invitation });
}
