import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from 'knex';

import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';
import { resolveAuthenticatedTenantAccess } from '../_shared/tenant-access';

interface OnboardingChecklistItem {
  key: string;
  label: string;
  is_completed: boolean;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const tenant = await tenantManagementService.retrieveTenant(tenantAccess.tenantId!);
  const members = await tenantManagementService.listTenantMembers(tenantAccess.tenantId!);
  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const salesChannelCountResult = await knex('sales_channel')
    .where({ tenant_id: tenantAccess.tenantId! })
    .whereNull('deleted_at')
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const salesChannelCount = Number(salesChannelCountResult?.count || 0);

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
      is_completed: salesChannelCount > 0,
    },
    {
      key: 'review_launch_readiness',
      label: 'Review launch readiness',
      is_completed: Boolean(tenant?.tenant_id),
    },
  ];

  res.status(200).json({
    count: checklist.length,
    completed: checklist.filter((item) => item.is_completed).length,
    checklist,
  });
}
