import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { ANALYTICS_MODULE } from '../../../../modules/analytics';
import AnalyticsModuleService from '../../../../modules/analytics/service';
import { getTenantIdFromRequest } from '../../../utils/tenant';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const analyticsService: AnalyticsModuleService = req.scope.resolve(ANALYTICS_MODULE);

  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  const series = await analyticsService.getTimeseries({
    tenant_id: tenantId,
    from,
    to,
  });

  return res.status(200).json({
    tenant_id: tenantId,
    from,
    to,
    granularity: 'day',
    data: series,
  });
}
