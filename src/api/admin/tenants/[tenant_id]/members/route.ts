import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const { tenant_id } = req.params;

  const members = await tenantManagementService.listTenantMembers(tenant_id);

  return res.status(200).json({
    count: members.length,
    members,
  });
}
