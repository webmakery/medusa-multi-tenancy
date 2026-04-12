import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import { THEME_MODULE } from '../../../../modules/theme';
import ThemeModuleService from '../../../../modules/theme/service';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const themeService: ThemeModuleService = req.scope.resolve(THEME_MODULE);

  const activeTheme = await themeService.getActiveThemeForTenant(tenantId);

  if (!activeTheme) {
    return res.status(200).json({
      theme: null,
      config: {},
      publish_status: 'unpublished',
      message: 'No active theme found for tenant',
    });
  }

  res.status(200).json({
    theme: activeTheme.metadata,
    config: activeTheme.config,
    publish_status: activeTheme.publish_status?.status || 'unpublished',
    published_at: activeTheme.publish_status?.published_at || null,
  });
}
