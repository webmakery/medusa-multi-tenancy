import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

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

async function ensureTenantTable(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tenant (
      id UUID PRIMARY KEY,
      slug VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      owner_email VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_slug ON tenant(slug);
    CREATE INDEX IF NOT EXISTS idx_tenant_owner_email ON tenant(owner_email);
  `);
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

  await ensureTenantTable(knex);

  const tenants = await knex('tenant')
    .select('id', 'name', 'slug', 'owner_email', 'status', 'created_at')
    .orderBy('created_at', 'desc');

  res.status(200).json({
    count: tenants.length,
    tenants,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

  await ensureTenantTable(knex);

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

  const existingTenant = await knex('tenant').where({ slug }).first();

  if (existingTenant) {
    return res.status(409).json({
      message: `A tenant with slug "${slug}" already exists.`,
    });
  }

  const tenant = {
    id: randomUUID(),
    name: body.name.trim(),
    slug,
    owner_email: body.owner_email.trim().toLowerCase(),
    status: 'active',
  };

  await knex('tenant').insert(tenant);

  res.status(201).json({
    tenant,
    onboarding_checklist: [
      'Create admin user and assign tenant owner role',
      'Configure store profile (name, support email, currency)',
      'Create first sales channel and default catalog',
      'Connect payment provider and shipping profile',
    ],
  });
}
