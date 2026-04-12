import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { requireIdempotencyKey } from '../../utils/idempotency';
import { resolveAuthenticatedTenantAccess } from '../_shared/tenant-access';

interface SalesChannelRecord {
  id: string;
  name: string;
  description: string | null;
  is_disabled: boolean;
}

interface CreateSalesChannelBody {
  name?: string;
  description?: string;
  is_enabled?: boolean;
}

function normalizeSalesChannel(channel: SalesChannelRecord) {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description || '',
    is_enabled: !channel.is_disabled,
  };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);

  const channels = (await knex('sales_channel')
    .where({
      tenant_id: tenantAccess.tenantId!,
    })
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc')
    .select('id', 'name', 'description', 'is_disabled')) as SalesChannelRecord[];

  res.status(200).json({
    count: channels.length,
    sales_channels: channels.map(normalizeSalesChannel),
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const _idempotencyKey = requireIdempotencyKey(req, res);
  if (!_idempotencyKey) return;

  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const body = (req.body || {}) as CreateSalesChannelBody;

  if (!body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }

  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);

  const created = {
    id: randomUUID(),
    tenant_id: tenantAccess.tenantId!,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    is_disabled: body.is_enabled === undefined ? false : !body.is_enabled,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  await knex('sales_channel').insert(created);

  const channel = (await knex('sales_channel')
    .where({
      id: created.id,
      tenant_id: tenantAccess.tenantId!,
    })
    .whereNull('deleted_at')
    .first('id', 'name', 'description', 'is_disabled')) as SalesChannelRecord;

  res.status(201).json({
    message: 'Sales channel created successfully.',
    sales_channel: normalizeSalesChannel(channel),
  });
}
