import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../modules/tenant-management/service';

interface UpdateStoreSettingsBody {
  store_name?: string;
  support_email?: string;
  default_currency_code?: string;
  timezone?: string;
}

function normalizeCurrency(code?: string): string {
  return (code || 'usd').trim().toLowerCase();
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const [tenant] = await tenantManagementService.listTenants();

  res.status(200).json({
    settings: {
      store_name: tenant?.name || 'My Store',
      support_email: tenant?.owner_email || 'support@example.com',
      default_currency_code: 'usd',
      timezone: 'UTC',
    },
  });
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as UpdateStoreSettingsBody;

  if (!body.store_name?.trim()) {
    return res.status(400).json({ message: 'store_name is required' });
  }

  if (!body.support_email?.trim()) {
    return res.status(400).json({ message: 'support_email is required' });
  }

  res.status(200).json({
    settings: {
      store_name: body.store_name.trim(),
      support_email: body.support_email.trim().toLowerCase(),
      default_currency_code: normalizeCurrency(body.default_currency_code),
      timezone: body.timezone?.trim() || 'UTC',
    },
    message: 'Store settings saved.',
  });
}
