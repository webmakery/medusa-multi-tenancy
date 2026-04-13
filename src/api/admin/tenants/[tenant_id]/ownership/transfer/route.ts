import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../../_shared/authorization';

interface TransferOwnershipBody {
  target_member_id?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const { tenant_id } = req.params;
  const body = (req.body || {}) as TransferOwnershipBody;

  const authorization = await authorizeTenantAction(req, res, 'manage_members');

  if (!authorization.allowed) {
    return;
  }

  if (authorization.actorRole !== 'owner') {
    return res.status(403).json({ message: 'Only owners can transfer ownership.' });
  }

  if (!body.target_member_id?.trim()) {
    return res.status(400).json({ message: 'target_member_id is required' });
  }

  try {
    const transfer = await tenantManagementService.transferOwnership({
      tenant_id,
      actor_email: authorization.actorEmail!,
      target_member_id: body.target_member_id,
    });

    return res.status(200).json({ transfer });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to transfer ownership.' });
  }
}
