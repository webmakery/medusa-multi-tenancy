import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import { THEME_MODULE } from '../../../../modules/theme';
import ThemeModuleService from '../../../../modules/theme/service';

interface UploadActivateThemeBody {
  name?: string;
  slug?: string;
  version?: string;
  author?: string;
  description?: string;
  config_json?: Record<string, any>;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as UploadActivateThemeBody;

  if (!body.name?.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  const slug = slugify(body.slug || body.name);

  if (!slug) {
    return res.status(400).json({ message: 'slug is required' });
  }

  const themeService: ThemeModuleService = req.scope.resolve(THEME_MODULE);
  const theme = await themeService.uploadAndActivateTheme({
    tenant_id: tenantId,
    name: body.name.trim(),
    slug,
    version: body.version,
    author: body.author,
    description: body.description,
    config_json: body.config_json,
  });

  res.status(201).json({
    message: 'Theme uploaded and activated successfully',
    theme,
  });
}
