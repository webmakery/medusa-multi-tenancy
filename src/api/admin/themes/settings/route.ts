import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import { THEME_MODULE } from '../../../../modules/theme';
import ThemeModuleService from '../../../../modules/theme/service';

interface EditThemeSettingsBody {
  theme_id?: string;
  config_json?: Record<string, any>;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as EditThemeSettingsBody;

  if (!body.config_json || typeof body.config_json !== 'object') {
    return res.status(400).json({ message: 'config_json object is required' });
  }

  const themeService: ThemeModuleService = req.scope.resolve(THEME_MODULE);

  const theme = await themeService.editThemeSettings({
    tenant_id: tenantId,
    theme_id: body.theme_id,
    config_json: body.config_json,
  });

  res.status(200).json({
    message: 'Theme settings updated successfully',
    theme,
  });
}
