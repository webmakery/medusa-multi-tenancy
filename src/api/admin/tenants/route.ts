import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';

interface CreateTenantBody {
  name?: string;
  slug?: string;
  owner_email?: string;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const tenants = await tenantManagementService.listTenants();

  res.status(200).json({
    count: tenants.length,
    tenants,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const body = (req.body || {}) as CreateTenantBody;

  if (!body.name?.trim()) {
    return res.status(400).json({
      message: 'name is required',
    });
  }

  if (!body.owner_email?.trim()) {
    return res.status(400).json({
      message: 'owner_email is required',
    });
  }

  const slug = slugify(body.slug || body.name);

  if (!slug) {
    return res.status(400).json({
      message: 'Could not generate a valid slug from name/slug.',
    });
  }

  try {
    const tenant = await tenantManagementService.createTenant({
      name: body.name.trim(),
      slug,
      owner_email: body.owner_email.trim().toLowerCase(),
    });

    res.status(201).json({
      tenant,
      onboarding_checklist: [
        'Create admin user and assign tenant owner role',
        'Configure store profile (name, support email, currency)',
        'Create first sales channel and default catalog',
        'Connect payment provider and shipping profile',
      ],
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }

    throw error;
  }
}
