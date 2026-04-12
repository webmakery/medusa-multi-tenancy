import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../../utils/tenant';
import { APPS_MODULE } from '../../../../../modules/apps';
import AppsModuleService from '../../../../../modules/apps/service';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const appId = req.params.app_id;

  if (!appId) {
    return res.status(400).json({ message: 'app_id parameter is required.' });
  }

  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);

  try {
    const credential = await appsModuleService.rotateAppSecret(tenantId, appId);

    res.status(200).json({
      message: 'App secret rotated successfully.',
      credential,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

    throw error;
  }
}
