import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';
import { requireTenantRole, resolveAuthenticatedTenantAccess } from '../../../_shared/tenant-access';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const { tenant_id } = req.params;

  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  if (tenantAccess.tenantId !== tenant_id) {
    return res.status(403).json({ message: 'You are not an active member of this tenant.' });
  }

  const roleCheck = requireTenantRole(tenantAccess, ['owner', 'admin', 'member', 'viewer']);
  if (!roleCheck.ok) {
    return res.status(roleCheck.status).json({ message: roleCheck.message });
  }

  const members = await tenantManagementService.listTenantMembers(tenant_id);

  return res.status(200).json({
    count: members.length,
    members,
  });
}
