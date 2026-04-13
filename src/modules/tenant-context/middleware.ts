import { AsyncLocalStorage } from 'async_hooks';

import type { Knex } from 'knex';

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getActiveTenantIdFromAuthContext, getActorEmail } from '../../api/admin/_shared/auth-context';
import { isTenantAccessBlocked } from '../tenant-management/lifecycle';
import { TenantRole } from '../tenant-management/service';

/**
 * Type for tenant context stored in AsyncLocalStorage
 */
export interface TenantContext {
  tenantId: string;
  actorEmail?: string;
  actorTenantRole?: TenantRole;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_OPERATOR_AUTH_METADATA_KEYS = [
  'platform_operator',
  'is_platform_operator',
  'is_admin',
  'admin',
] as const;
const TENANT_OPTIONAL_ROUTE_PATTERNS: RegExp[] = [
  /^\/health\/?$/i,
  /^\/store\/tenants\/signup\/?$/i,
  /^\/store\/apps\/webhooks\//i,
  /^\/admin\/tenants\/?$/i,
  /^\/admin\/tenants\/active\/?$/i,
  /^\/admin\/tenants\/invitations\/accept\/?$/i,
  /^\/admin\/auth\//i,
  /^\/auth\//i,
];
const TENANT_LIFECYCLE_OVERRIDE_ROUTE_PATTERNS: RegExp[] = [
  /^\/admin\/tenants\/[^/]+\/reactivate\/?$/i,
];

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

function getPathname(req: MedusaRequest): string {
  return (req.path || req.originalUrl || '').split('?')[0] || '/';
}

function isAdminPath(req: MedusaRequest): boolean {
  return getPathname(req).startsWith('/admin');
}

function isStorePath(req: MedusaRequest): boolean {
  return getPathname(req).startsWith('/store');
}

function isTenantOptionalRoute(req: MedusaRequest): boolean {
  const pathname = getPathname(req);
  return TENANT_OPTIONAL_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function allowsLifecycleOverride(req: MedusaRequest): boolean {
  const pathname = getPathname(req);
  return TENANT_LIFECYCLE_OVERRIDE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hasBasicApiKeyAuth(req: MedusaRequest): boolean {
  const authorization = normalizeHeaderValue(req.headers.authorization)?.trim();
  return Boolean(authorization && authorization.toLowerCase().startsWith('basic '));
}

function isTruthy(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function isPlatformOperator(req: MedusaRequest): boolean {
  if (hasBasicApiKeyAuth(req)) {
    return true;
  }

  const authContext = (req as any).auth_context;

  for (const key of PLATFORM_OPERATOR_AUTH_METADATA_KEYS) {
    if (isTruthy(authContext?.app_metadata?.[key]) || isTruthy(authContext?.auth_identity?.app_metadata?.[key])) {
      return true;
    }
  }

  const operatorHeader = normalizeHeaderValue(req.headers['x-platform-operator']);

  if (!operatorHeader) {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return isTruthy(operatorHeader);
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
  const tenantIdParam = (req.params as Record<string, string | undefined>)?.tenant_id;
  if (tenantIdParam?.trim() && UUID_REGEX.test(tenantIdParam.trim())) {
    return tenantIdParam.trim();
  }

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

async function getMembershipForTenant(req: MedusaRequest, tenantId: string, actorEmail: string) {
  const knex = req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;

  if (!knex) {
    return null;
  }

  return knex('tenant_membership')
    .select('tenant_id', 'user_email', 'role', 'status')
    .where({
      tenant_id: tenantId,
      user_email: actorEmail,
      status: 'active',
    })
    .first();
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
    .join('tenant', 'tenant.tenant_id', 'tenant_membership.tenant_id')
    .select('tenant_membership.tenant_id', 'tenant_membership.role', 'tenant_membership.status')
    .where({ 'tenant_membership.user_email': actorEmail, 'tenant_membership.status': 'active', 'tenant.status': 'active' });

  if (!memberships.length) {
    return null;
  }

  const headerTenantId = normalizeHeaderValue(req.headers['x-tenant-id'])?.trim();
  const activeTenantId = getActiveTenantIdFromAuthContext(req);
  const selectedTenantId = headerTenantId || activeTenantId || (memberships.length === 1 ? memberships[0].tenant_id : null);

  if (!selectedTenantId) {
    throw Object.assign(new Error('active_tenant_id is required for users belonging to multiple tenants.'), { status: 400 });
  }

  const selectedMembership = memberships.find((membership) => membership.tenant_id === selectedTenantId);

  if (!selectedMembership) {
    throw Object.assign(new Error('You are not an active member of the selected tenant.'), { status: 403 });
  }

  req.headers['x-tenant-id'] = selectedTenantId;

  const authContext = (req as any).auth_context;
  if (authContext) {
    authContext.app_metadata = {
      ...(authContext.app_metadata || {}),
      active_tenant_id: selectedTenantId,
      tenant_role: selectedMembership.role,
    };
    authContext.user_metadata = {
      ...(authContext.user_metadata || {}),
      active_tenant_id: selectedTenantId,
      tenant_role: selectedMembership.role,
    };
  }

  return selectedTenantId;
}

async function enforceTenantScope(req: MedusaRequest, tenantId: string | null): Promise<void> {
  if ((!isAdminPath(req) && !isStorePath(req)) || isTenantOptionalRoute(req)) {
    return;
  }

  if (!tenantId) {
    if (isAdminPath(req) && isPlatformOperator(req)) {
      return;
    }

    throw Object.assign(
      new Error('Tenant scope is required for this endpoint. Provide x-tenant-id or select an active tenant.'),
      { status: 400 }
    );
  }
}

async function enforceTenantLifecycleState(req: MedusaRequest, tenantId: string | null): Promise<void> {
  if (!tenantId || isTenantOptionalRoute(req) || allowsLifecycleOverride(req)) {
    return;
  }

  const knex = req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;

  if (!knex) {
    return;
  }

  const tenant = await knex('tenant').select('status').where({ tenant_id: tenantId }).first();
  if (isTenantAccessBlocked(tenant?.status)) {
    throw Object.assign(new Error(`Tenant access is blocked while status is "${tenant?.status || 'unknown'}".`), {
      status: 423,
    });
  }
}

export async function tenantContextMiddleware(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    await enforceAdminTenantSelection(req);
    const tenantId = await resolveTenantId(req);
    await enforceTenantScope(req, tenantId);
    await enforceTenantLifecycleState(req, tenantId);

    const actorEmail = getActorEmail(req) || undefined;
    let actorTenantRole: TenantRole | undefined;

    if (tenantId && actorEmail) {
      const membership = await getMembershipForTenant(req, tenantId, actorEmail);

      if (membership?.role) {
        actorTenantRole = membership.role;
      }
    }

    if (tenantId) {
      req.headers['x-tenant-id'] = tenantId;
      (req as any).tenant_context = {
        tenant_id: tenantId,
        actor_email: actorEmail,
        actor_tenant_role: actorTenantRole,
      };

      const authContext = (req as any).auth_context;
      if (authContext) {
        authContext.app_metadata = {
          ...(authContext.app_metadata || {}),
          active_tenant_id: tenantId,
          ...(actorTenantRole ? { tenant_role: actorTenantRole } : {}),
        };
        authContext.user_metadata = {
          ...(authContext.user_metadata || {}),
          active_tenant_id: tenantId,
          ...(actorTenantRole ? { tenant_role: actorTenantRole } : {}),
        };
      }

      return tenantContextStorage.run({ tenantId, actorEmail, actorTenantRole }, () => {
        next();
      });
    }

    next();
  } catch (error: any) {
    return _res.status(error.status || 400).json({ message: error.message || 'Invalid tenant context.' });
  }
}
