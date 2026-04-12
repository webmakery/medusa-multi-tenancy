import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../utils/tenant';
import { APPS_MODULE } from '../../../modules/apps';
import AppsModuleService from '../../../modules/apps/service';

interface InstallAppBody {
  app_name?: string;
  app_identifier?: string;
  app_url?: string;
  scopes?: string[];
  webhooks?: Array<{ event_name: string; target_url: string }>;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);
  const apps = await appsModuleService.listInstalledApps(tenantId);

  res.status(200).json({
    count: apps.length,
    apps,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as InstallAppBody;

  if (!body.app_name?.trim() || !body.app_identifier?.trim()) {
    return res.status(400).json({ message: 'app_name and app_identifier are required.' });
  }

  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);

  try {
    const installed = await appsModuleService.installApp({
      tenant_id: tenantId,
      app_name: body.app_name.trim(),
      app_identifier: body.app_identifier.trim(),
      app_url: body.app_url?.trim(),
      scopes: body.scopes,
      webhooks: body.webhooks,
    });

    return res.status(201).json({
      message: 'App installed successfully.',
      app: installed,
    });
  } catch (error: any) {
    if (error.message?.includes('already installed')) {
      return res.status(409).json({ message: error.message });
    }

    throw error;
  }
}
