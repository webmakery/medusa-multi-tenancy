import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import { THEME_MODULE } from '../../../../modules/theme';
import ThemeModuleService from '../../../../modules/theme/service';

interface PublishThemeBody {
  theme_id?: string;
  publish?: boolean;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as PublishThemeBody;

  if (typeof body.publish !== 'boolean') {
    return res.status(400).json({ message: 'publish boolean is required' });
  }

  const themeService: ThemeModuleService = req.scope.resolve(THEME_MODULE);

  const theme = await themeService.setThemePublishStatus({
    tenant_id: tenantId,
    theme_id: body.theme_id,
    publish: body.publish,
  });

  res.status(200).json({
    message: body.publish ? 'Theme published successfully' : 'Theme unpublished successfully',
    theme,
  });
}
