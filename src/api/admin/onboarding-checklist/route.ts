import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';

interface OnboardingChecklistItem {
  key: string;
  label: string;
  is_completed: boolean;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const [tenant] = await tenantManagementService.listTenants();
  const members = tenant?.tenant_id
    ? await tenantManagementService.listTenantMembers(tenant.tenant_id)
    : [];

  const checklist: OnboardingChecklistItem[] = [
    {
      key: 'create_store_profile',
      label: 'Create store profile',
      is_completed: Boolean(tenant?.name),
    },
    {
      key: 'invite_team',
      label: 'Invite team member',
      is_completed: members.length > 1,
    },
    {
      key: 'add_sales_channel',
      label: 'Add sales channel',
      is_completed: true,
    },
    {
      key: 'review_launch_readiness',
      label: 'Review launch readiness',
      is_completed: Boolean(tenant),
    },
  ];

  res.status(200).json({
    count: checklist.length,
    completed: checklist.filter((item) => item.is_completed).length,
    checklist,
  });
}
