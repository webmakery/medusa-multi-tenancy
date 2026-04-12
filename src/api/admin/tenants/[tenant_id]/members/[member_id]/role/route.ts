import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../../../modules/tenant-management/service';

interface UpdateRoleBody {
  role?: 'owner' | 'admin' | 'staff';
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const body = (req.body || {}) as UpdateRoleBody;
  const { tenant_id, member_id } = req.params;

  if (!body.role) {
    return res.status(400).json({ message: 'role is required' });
  }

  try {
    const member = await tenantManagementService.updateMemberRole({
      tenant_id,
      member_id,
      role: body.role,
    });

    return res.status(200).json({ member });
  } catch (error: any) {
    return res.status(404).json({ message: error.message || 'Member not found.' });
  }
}
