import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { CreateTenantBody, validateCreateTenantBody } from './utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const tenants = await knex('tenant')
    .select('id', 'name', 'slug', 'owner_email', 'status', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    count: tenants.length,
    limit,
    offset,
    tenants,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  const body = (req.body || {}) as CreateTenantBody;

  const validation = validateCreateTenantBody(body);
  if (!validation.valid || !validation.normalized) {
    return res.status(400).json({
      message: validation.message,
    });
  }

  const { name, slug, ownerEmail } = validation.normalized;

  const existingTenant = await knex('tenant').where({ slug }).first();
  if (existingTenant) {
    return res.status(409).json({
      message: `A tenant with slug "${slug}" already exists.`,
    });
  }

  const tenant = {
    id: randomUUID(),
    name,
    slug,
    owner_email: ownerEmail,
    status: 'active',
  };

  try {
    await knex('tenant').insert(tenant);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        message: `A tenant with slug "${slug}" already exists.`,
      });
    }

    throw error;
  }

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
