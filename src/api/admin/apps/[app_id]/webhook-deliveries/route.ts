import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { APPS_MODULE } from '../../../../../modules/apps';
import AppsModuleService from '../../../../../modules/apps/service';
import { getTenantIdFromRequest } from '../../../../utils/tenant';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const appId = req.params.app_id;

  if (!appId) {
    return res.status(400).json({ message: 'app_id parameter is required.' });
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) || '50', 10);
  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);
  const logs = await appsModuleService.listWebhookDeliveryLogs(tenantId, appId, parsedLimit);

  res.status(200).json({
    count: logs.length,
    logs,
  });
}
