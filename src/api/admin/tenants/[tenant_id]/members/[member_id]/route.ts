import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../../_shared/authorization';
import { requireTenantConfirmation } from '../../../../_shared/tenant-confirmation';

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const { tenant_id, member_id } = req.params;

  const authorization = await authorizeTenantAction(req, res, 'manage_members');

  if (!authorization.allowed) {
    return;
  }

  if (!requireTenantConfirmation(req, res, { tenantId: tenant_id, operationLabel: 'remove tenant members' })) {
    return;
  }

  try {
    const member = await tenantManagementService.removeMember({
      tenant_id,
      member_id,
      actor: authorization.actorEmail,
    });

    return res.status(200).json({
      id: member.id,
      object: 'tenant_member',
      deleted: true,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to remove member.' });
  }
}
