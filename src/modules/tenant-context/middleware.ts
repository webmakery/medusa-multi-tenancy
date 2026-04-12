import { AsyncLocalStorage } from 'async_hooks';

import type { Knex } from 'knex';

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getActiveTenantIdFromAuthContext, getActorEmail } from '../../api/admin/_shared/auth-context';

/**
 * Type for tenant context stored in AsyncLocalStorage
 */
export interface TenantContext {
  tenantId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!/^[a-z0-9-]{1,64}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function getSubdomainFromRequest(req: MedusaRequest): string | null {
  const forwardedHost = normalizeHeaderValue(req.headers['x-forwarded-host']);
  const hostHeader = normalizeHeaderValue(req.headers.host);
  const host = (forwardedHost || hostHeader || '').split(',')[0]?.trim().toLowerCase();

  if (!host) {
    return null;
  }

  const hostname = host.split(':')[0];

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^[0-9.]+$/.test(hostname)
  ) {
    return null;
  }

  const segments = hostname.split('.').filter(Boolean);

  if (segments.length < 3) {
    return null;
  }

  return normalizeSlug(segments[0]);
}

async function resolveTenantIdFromSlug(req: MedusaRequest, slug: string): Promise<string | null> {
  const knex = req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;

  if (!knex) {
    return null;
  }

  const tenant = await knex('tenant').select('tenant_id').where({ slug }).first();

  if (tenant?.tenant_id && UUID_REGEX.test(tenant.tenant_id)) {
    return tenant.tenant_id;
  }

  return null;
}

async function resolveTenantId(req: MedusaRequest): Promise<string | null> {
  const headerValue = normalizeHeaderValue(req.headers['x-tenant-id']);

  if (headerValue?.trim()) {
    const normalized = headerValue.trim();

    if (UUID_REGEX.test(normalized)) {
      return normalized;
    }

    const tenantIdFromSlugHeader = await resolveTenantIdFromSlug(req, normalizeSlug(normalized) || '');
    if (tenantIdFromSlugHeader) {
      return tenantIdFromSlugHeader;
    }
  }

  const slugCandidates: Array<string | null> = [
    normalizeSlug(normalizeHeaderValue(req.headers['x-tenant-slug'])),
    normalizeSlug(req.query?.tenant_slug),
    normalizeSlug(req.query?.tenant),
    getSubdomainFromRequest(req),
  ];

  for (const slug of slugCandidates) {
    if (!slug) {
      continue;
    }

    const tenantId = await resolveTenantIdFromSlug(req, slug);

    if (tenantId) {
      return tenantId;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const fromQuery = req.query?.tenant_id;

    if (typeof fromQuery === 'string' && UUID_REGEX.test(fromQuery.trim())) {
      return fromQuery.trim();
    }
  }

  return null;
}

function isAdminPath(req: MedusaRequest): boolean {
  return req.originalUrl.startsWith('/admin');
}

async function enforceAdminTenantSelection(req: MedusaRequest): Promise<string | null> {
  if (!isAdminPath(req)) {
    return null;
  }

  const knex = req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;

  if (!knex) {
    return null;
  }

  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    return null;
  }

  const memberships = await knex('tenant_membership')
    .select('tenant_id', 'status')
    .where({ user_email: actorEmail, status: 'active' });

  if (!memberships.length) {
    return null;
  }

  const headerTenantId = normalizeHeaderValue(req.headers['x-tenant-id'])?.trim();
  const activeTenantId = getActiveTenantIdFromAuthContext(req);
  const selectedTenantId = headerTenantId || activeTenantId || (memberships.length === 1 ? memberships[0].tenant_id : null);

  if (!selectedTenantId) {
    throw Object.assign(new Error('active_tenant_id is required for users belonging to multiple tenants.'), { status: 400 });
  }

  const isAllowedTenant = memberships.some((membership) => membership.tenant_id === selectedTenantId);

  if (!isAllowedTenant) {
    throw Object.assign(new Error('You are not an active member of the selected tenant.'), { status: 403 });
  }

  req.headers['x-tenant-id'] = selectedTenantId;

  const authContext = (req as any).auth_context;
  if (authContext) {
    authContext.app_metadata = {
      ...(authContext.app_metadata || {}),
      active_tenant_id: selectedTenantId,
    };
  }

  return selectedTenantId;
}

export async function tenantContextMiddleware(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    await enforceAdminTenantSelection(req);
  } catch (error: any) {
    return _res.status(error.status || 400).json({ message: error.message || 'Invalid tenant context.' });
  }

  const tenantId = await resolveTenantId(req);

  if (tenantId) {
    req.headers['x-tenant-id'] = tenantId;

    return tenantContextStorage.run({ tenantId }, () => {
      next();
    });
  }

  next();
}
