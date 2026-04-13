import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { ANALYTICS_MODULE } from '../../../../modules/analytics';
import AnalyticsModuleService from '../../../../modules/analytics/service';
import { BILLING_MODULE } from '../../../../modules/billing';
import BillingModuleService from '../../../../modules/billing/service';
import { getTenantIdFromRequest } from '../../../utils/tenant';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as {
    event_type?: 'session_started' | 'checkout_started';
    session_id?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.event_type || !['session_started', 'checkout_started'].includes(body.event_type)) {
    return res.status(400).json({ message: 'event_type must be one of: session_started, checkout_started' });
  }

  const analyticsService: AnalyticsModuleService = req.scope.resolve(ANALYTICS_MODULE);
  const billingService: BillingModuleService = req.scope.resolve(BILLING_MODULE);

  try {
    await billingService.recordMeteredEvent({
      tenant_id: tenantId,
      meter_key: 'analytics.events',
      quantity: 1,
      metadata: { event_type: body.event_type },
    });
  } catch (error: any) {
    if (error.message?.includes('Plan limit reached') || error.message?.includes('Billing account is suspended')) {
      return res.status(402).json({ message: error.message });
    }

    throw error;
  }

  await analyticsService.recordEvent({
    tenant_id: tenantId,
    event_type: body.event_type,
    session_id: body.session_id,
    metadata: body.metadata,
  });

  return res.status(202).json({
    accepted: true,
  });
}
