import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../../../_shared/authorization';
import { requireTenantConfirmation } from '../../../../../_shared/tenant-confirmation';

interface UpdateRoleBody {
  role?: 'owner' | 'admin' | 'member' | 'viewer' | 'staff';
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const body = (req.body || {}) as UpdateRoleBody;
  const { tenant_id, member_id } = req.params;

  const authorization = await authorizeTenantAction(req, res, 'manage_members');

  if (!authorization.allowed) {
    return;
  }

  if (!body.role) {
    return res.status(400).json({ message: 'role is required' });
  }

  if (!requireTenantConfirmation(req, res, { tenantId: tenant_id, operationLabel: 'change member roles' })) {
    return;
  }

  try {
    const member = await tenantManagementService.updateMemberRole({
      tenant_id,
      member_id,
      role: body.role,
      actor: authorization.actorEmail,
    });

    return res.status(200).json({ member });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to update member role.' });
  }
}
