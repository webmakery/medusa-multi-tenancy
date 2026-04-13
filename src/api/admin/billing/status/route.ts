import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { BILLING_MODULE } from '../../../../modules/billing';
import BillingModuleService from '../../../../modules/billing/service';
import { requireTenantRole, resolveAuthenticatedTenantAccess } from '../../_shared/tenant-access';

type BillingAction = 'renew' | 'payment_failed' | 'payment_recovered' | 'expire_grace';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const billingService: BillingModuleService = req.scope.resolve(BILLING_MODULE);
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const roleCheck = requireTenantRole(tenantAccess, ['owner', 'admin']);
  if (!roleCheck.ok) {
    return res.status(roleCheck.status).json({ message: roleCheck.message });
  }

  const overview = await billingService.getBillingOverview(tenantAccess.tenantId!);

  return res.status(200).json({
    billing: overview,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const billingService: BillingModuleService = req.scope.resolve(BILLING_MODULE);
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const roleCheck = requireTenantRole(tenantAccess, ['owner', 'admin']);
  if (!roleCheck.ok) {
    return res.status(roleCheck.status).json({ message: roleCheck.message });
  }

  const action = ((req.body || {}) as { action?: BillingAction }).action;

  if (!action || !['renew', 'payment_failed', 'payment_recovered', 'expire_grace'].includes(action)) {
    return res.status(400).json({
      message: 'action must be one of: renew, payment_failed, payment_recovered, expire_grace',
    });
  }

  if (action === 'renew' || action === 'payment_recovered') {
    const billing = await billingService.processRenewal(tenantAccess.tenantId!);
    return res.status(200).json({ billing });
  }

  if (action === 'payment_failed') {
    const billing = await billingService.markPaymentFailed(tenantAccess.tenantId!);
    return res.status(200).json({ billing });
  }

  const billing = await billingService.applyLifecycleTransitions(tenantAccess.tenantId!);
  return res.status(200).json({ billing });
}
