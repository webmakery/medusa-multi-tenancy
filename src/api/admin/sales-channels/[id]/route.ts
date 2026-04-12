import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { resolveAuthenticatedTenantAccess } from '../../_shared/tenant-access';

interface SalesChannelRecord {
  id: string;
  name: string;
  description: string | null;
  is_disabled: boolean;
}

interface UpdateSalesChannelBody {
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

async function getTenantChannel(knex: Knex, tenantId: string, channelId: string) {
  return (await knex('sales_channel')
    .where({
      id: channelId,
      tenant_id: tenantId,
    })
    .whereNull('deleted_at')
    .first('id', 'name', 'description', 'is_disabled')) as SalesChannelRecord | undefined;
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const channelId = req.params.id;

  if (!channelId) {
    return res.status(400).json({ message: 'id parameter is required.' });
  }

  const body = (req.body || {}) as UpdateSalesChannelBody;
  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);

  const existing = await getTenantChannel(knex, tenantAccess.tenantId!, channelId);

  if (!existing) {
    return res.status(404).json({ message: 'Sales channel not found.' });
  }

  const hasName = typeof body.name === 'string';
  const hasDescription = typeof body.description === 'string';
  const hasEnabled = typeof body.is_enabled === 'boolean';

  if (!hasName && !hasDescription && !hasEnabled) {
    return res.status(400).json({ message: 'At least one of name, description, or is_enabled must be provided.' });
  }

  if (hasName && !body.name?.trim()) {
    return res.status(400).json({ message: 'name cannot be empty.' });
  }

  await knex('sales_channel')
    .where({
      id: channelId,
      tenant_id: tenantAccess.tenantId!,
    })
    .update({
      ...(hasName ? { name: body.name!.trim() } : {}),
      ...(hasDescription ? { description: body.description!.trim() || null } : {}),
      ...(hasEnabled ? { is_disabled: !body.is_enabled } : {}),
      updated_at: knex.fn.now(),
    });

  const updated = await getTenantChannel(knex, tenantAccess.tenantId!, channelId);

  res.status(200).json({
    message: 'Sales channel updated successfully.',
    sales_channel: normalizeSalesChannel(updated!),
  });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const channelId = req.params.id;

  if (!channelId) {
    return res.status(400).json({ message: 'id parameter is required.' });
  }

  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const existing = await getTenantChannel(knex, tenantAccess.tenantId!, channelId);

  if (!existing) {
    return res.status(404).json({ message: 'Sales channel not found.' });
  }

  await knex('sales_channel')
    .where({
      id: channelId,
      tenant_id: tenantAccess.tenantId!,
    })
    .whereNull('deleted_at')
    .update({
      deleted_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

  res.status(200).json({
    message: 'Sales channel deleted successfully.',
    id: channelId,
  });
}
