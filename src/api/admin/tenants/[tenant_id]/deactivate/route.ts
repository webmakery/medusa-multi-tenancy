import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../_shared/authorization';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const { tenant_id } = req.params;

  const authorization = await authorizeTenantAction(req, res, 'deactivate_tenant');

  if (!authorization.allowed) {
    return;
  }

  try {
    const tenant = await tenantManagementService.deactivateTenant(tenant_id, authorization.actorEmail);

    return res.status(200).json({ tenant });
  } catch (error: any) {
    return res.status(404).json({ message: error.message || 'Tenant not found.' });
  }
}
