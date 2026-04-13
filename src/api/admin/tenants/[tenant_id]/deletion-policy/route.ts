import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import { TENANT_DELETION_RETENTION_DAYS } from '../../../../../modules/tenant-management/lifecycle';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../_shared/authorization';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const { tenant_id } = req.params;

  const tenant = await tenantManagementService.retrieveTenant(tenant_id);
  if (!tenant) {
    return res.status(404).json({ message: 'Tenant not found.' });
  }

  return res.status(200).json({
    tenant_id,
    policy: {
      strategy: 'soft_delete_then_hard_delete',
      retention_days: TENANT_DELETION_RETENTION_DAYS,
      legal_constraints: ['legal_hold_blocks_hard_delete', 'billing_and_audit_records_preserved'],
      deletion_requested_at: tenant.deletion_requested_at,
      scheduled_purge_at: tenant.scheduled_purge_at,
      deleted_at: tenant.deleted_at,
      current_status: tenant.status,
    },
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const { tenant_id } = req.params;

  const authorization = await authorizeTenantAction(req, res, 'request_deletion');
  if (!authorization.allowed) {
    return;
  }

  try {
    const tenant = await tenantManagementService.requestTenantDeletion(tenant_id, authorization.actorEmail);
    return res.status(202).json({
      tenant,
      message: `Deletion requested. Tenant data is retained for ${TENANT_DELETION_RETENTION_DAYS} days before hard delete eligibility.`,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to request tenant deletion.' });
  }
}

