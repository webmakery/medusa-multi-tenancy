import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';
import createTenantOnboardingWorkflow from '../../../workflows/tenant/create-tenant';

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

function getIdempotencyKey(req: MedusaRequest): string | null {
  const value = req.headers['idempotency-key'];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && value[0]?.trim()) {
    return value[0].trim();
  }

  return null;
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

  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    return res.status(400).json({
      message: 'idempotency-key header is required',
    });
  }

  const slug = slugify(body.slug || body.name);

  if (!slug) {
    return res.status(400).json({
      message: 'Could not generate a valid slug from name/slug.',
    });
  }

  try {
    const { result } = await createTenantOnboardingWorkflow(req.scope).run({
      input: {
        name: body.name.trim(),
        slug,
        owner_email: body.owner_email.trim().toLowerCase(),
      },
      context: {
        idempotencyKey: `admin-tenants:${idempotencyKey}`,
      },
    });

    res.status(201).json({
      tenant: result.tenant,
      owner_membership_id: result.owner_membership_id,
      default_sales_channel: result.default_sales_channel,
      store: result.store,
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }

    throw error;
  }
}
