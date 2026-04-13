import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import { APPS_MODULE } from '../../../../modules/apps';
import AppsModuleService from '../../../../modules/apps/service';
import { requireTenantConfirmation } from '../../_shared/tenant-confirmation';

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const appId = req.params.app_id;

  if (!appId) {
    return res.status(400).json({ message: 'app_id parameter is required.' });
  }

  if (!requireTenantConfirmation(req, res, { tenantId, operationLabel: 'uninstall this app' })) {
    return;
  }

  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);

  try {
    await appsModuleService.uninstallApp(tenantId, appId);

    res.status(200).json({
      message: 'App uninstalled successfully.',
      app_id: appId,
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }

    throw error;
  }
}
