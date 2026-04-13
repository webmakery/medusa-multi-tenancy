import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, generateJwtToken } from '@medusajs/framework/utils';

import { getActorEmail } from './auth-context';

export type TenantAccessRole = 'platform_admin' | 'tenant_admin';

export interface TenantUserAccessRecord {
  id: string;
  user_id: string | null;
  user_email: string;
  tenant_id: string | null;
  role: TenantAccessRole;
  is_platform_admin: boolean;
  active_tenant_id: string | null;
  is_auto_provisioned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResolvedTenantUserAccess {
  actorEmail?: string;
  isPlatformAdmin: boolean;
  role: TenantAccessRole;
  assignedTenantId: string | null;
  activeTenantId: string | null;
  effectiveTenantId: string | null;
  accessRecord?: TenantUserAccessRecord;
  autoProvisioned: boolean;
}

function getKnex(req: MedusaRequest): Knex | undefined {
  return req.scope?.resolve?.(ContainerRegistrationKeys.PG_CONNECTION) as Knex | undefined;
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getPlatformAdminEmails(): Set<string> {
  const rawValue = process.env.PLATFORM_ADMIN_EMAILS || '';

  return new Set(
    rawValue
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isPlatformAdminEmail(email: string): boolean {
  return getPlatformAdminEmails().has(email.trim().toLowerCase());
}

function getAutoCreateEnabled(): boolean {
  return parseBooleanEnv(process.env.AUTO_CREATE_TENANT_ON_FIRST_LOGIN, true);
}

export function isLegacyTenantHeaderEnabled(): boolean {
  return parseBooleanEnv(process.env.ALLOW_LEGACY_TENANT_HEADER, false);
}

function slugifyEmailForTenant(email: string): string {
  const localPart = email.split('@')[0] || 'tenant';
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safeBase = normalized || 'tenant';
  const suffix = randomUUID().split('-')[0];

  return `${safeBase}-${suffix}`.slice(0, 63);
}

function buildDefaultTenantName(email: string): string {
  const localPart = email.split('@')[0] || 'Tenant';
  const normalized = localPart.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const title = normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Tenant';

  return `${title} Workspace`;
}

async function createTenantForUser(trx: Knex.Transaction, email: string): Promise<string> {
  const tenantId = randomUUID();

  await trx('tenant').insert({
    id: tenantId,
    tenant_id: tenantId,
    slug: slugifyEmailForTenant(email),
    name: buildDefaultTenantName(email),
    owner_email: email,
    status: 'active',
    settings_json: {
      locale: 'en-US',
      timezone: 'UTC',
      currency_code: 'usd',
      lifecycle: {
        billing_mode: 'preserve_on_suspension',
        retention_days: 90,
      },
    },
  });

  await trx('tenant_membership').insert({
    id: randomUUID(),
    tenant_id: tenantId,
    user_email: email,
    role: 'owner',
    status: 'active',
  });

  return tenantId;
}

async function getTenantUserAccessByEmail(knex: Knex, email: string): Promise<TenantUserAccessRecord | undefined> {
  return knex('tenant_user_access').where({ user_email: email }).first();
}

export async function resolveTenantUserAccess(req: MedusaRequest): Promise<ResolvedTenantUserAccess> {
  const actorEmail = getActorEmail(req) || undefined;

  if (!actorEmail) {
    return {
      actorEmail,
      isPlatformAdmin: false,
      role: 'tenant_admin',
      assignedTenantId: null,
      activeTenantId: null,
      effectiveTenantId: null,
      autoProvisioned: false,
    };
  }

  const knex = getKnex(req);

  if (!knex) {
    return {
      actorEmail,
      isPlatformAdmin: isPlatformAdminEmail(actorEmail),
      role: isPlatformAdminEmail(actorEmail) ? 'platform_admin' : 'tenant_admin',
      assignedTenantId: null,
      activeTenantId: null,
      effectiveTenantId: null,
      autoProvisioned: false,
    };
  }

  const platformAdmin = isPlatformAdminEmail(actorEmail);
  const autoCreateEnabled = getAutoCreateEnabled();

  const resolved = await knex.transaction(async (trx) => {
    let existingRecord = await getTenantUserAccessByEmail(trx, actorEmail);
    let autoProvisioned = false;

    if (!existingRecord) {
      let assignedTenantId: string | null = null;

      if (!platformAdmin && autoCreateEnabled) {
        assignedTenantId = await createTenantForUser(trx, actorEmail);
        autoProvisioned = true;
      }

      const record: Omit<TenantUserAccessRecord, 'created_at' | 'updated_at'> = {
        id: randomUUID(),
        user_id: null,
        user_email: actorEmail,
        tenant_id: platformAdmin ? null : assignedTenantId,
        role: platformAdmin ? 'platform_admin' : 'tenant_admin',
        is_platform_admin: platformAdmin,
        active_tenant_id: platformAdmin ? null : assignedTenantId,
        is_auto_provisioned: autoProvisioned,
      };

      await trx('tenant_user_access').insert(record);
      existingRecord = await getTenantUserAccessByEmail(trx, actorEmail);
    }

    if (!existingRecord) {
      throw new Error('Could not resolve tenant access record.');
    }

    const nextRole: TenantAccessRole = platformAdmin ? 'platform_admin' : 'tenant_admin';
    const shouldSyncPlatformState = existingRecord.is_platform_admin !== platformAdmin || existingRecord.role !== nextRole;

    if (shouldSyncPlatformState) {
      const nextActiveTenantId = platformAdmin ? existingRecord.active_tenant_id : existingRecord.tenant_id;
      await trx('tenant_user_access').where({ id: existingRecord.id }).update({
        is_platform_admin: platformAdmin,
        role: nextRole,
        tenant_id: platformAdmin ? null : existingRecord.tenant_id,
        active_tenant_id: nextActiveTenantId,
        updated_at: trx.fn.now(),
      });

      existingRecord = await getTenantUserAccessByEmail(trx, actorEmail);
    }

    return { accessRecord: existingRecord, autoProvisioned };
  });

  const accessRecord = resolved.accessRecord as TenantUserAccessRecord;
  const isPlatformAdmin = Boolean(accessRecord.is_platform_admin);
  const assignedTenantId = accessRecord.tenant_id || null;
  const activeTenantId = accessRecord.active_tenant_id || null;
  const effectiveTenantId = isPlatformAdmin ? activeTenantId : assignedTenantId;

  return {
    actorEmail,
    isPlatformAdmin,
    role: isPlatformAdmin ? 'platform_admin' : 'tenant_admin',
    assignedTenantId,
    activeTenantId,
    effectiveTenantId,
    accessRecord,
    autoProvisioned: resolved.autoProvisioned || Boolean(accessRecord.is_auto_provisioned),
  };
}

export async function activatePlatformAdminTenant(
  req: MedusaRequest,
  tenantId: string | null
): Promise<TenantUserAccessRecord> {
  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    throw Object.assign(new Error('Authenticated user email is required.'), { status: 401 });
  }

  const knex = getKnex(req);

  if (!knex) {
    throw Object.assign(new Error('Database connection unavailable.'), { status: 500 });
  }

  const access = await resolveTenantUserAccess(req);

  if (!access.isPlatformAdmin || !access.accessRecord) {
    throw Object.assign(new Error('Only platform admins can activate tenant context.'), { status: 403 });
  }

  if (tenantId) {
    const tenant = await knex('tenant').select('tenant_id').where({ tenant_id: tenantId }).first();

    if (!tenant?.tenant_id) {
      throw Object.assign(new Error('Tenant not found.'), { status: 404 });
    }
  }

  await knex('tenant_user_access').where({ id: access.accessRecord.id }).update({
    active_tenant_id: tenantId,
    updated_at: knex.fn.now(),
  });

  const updated = await knex('tenant_user_access').where({ id: access.accessRecord.id }).first();

  if (!updated) {
    throw Object.assign(new Error('Unable to persist active tenant selection.'), { status: 500 });
  }

  return updated;
}

export async function assignUserToTenant(req: MedusaRequest, input: { user_email: string; tenant_id: string }) {
  const knex = getKnex(req);

  if (!knex) {
    throw Object.assign(new Error('Database connection unavailable.'), { status: 500 });
  }

  const normalizedEmail = input.user_email.trim().toLowerCase();
  const tenantId = input.tenant_id.trim();

  const tenant = await knex('tenant').select('tenant_id').where({ tenant_id: tenantId }).first();

  if (!tenant?.tenant_id) {
    throw Object.assign(new Error('Tenant not found.'), { status: 404 });
  }

  const existingAccess = await knex('tenant_user_access').where({ user_email: normalizedEmail }).first();

  if (existingAccess) {
    await knex('tenant_user_access').where({ id: existingAccess.id }).update({
      tenant_id: tenantId,
      role: 'tenant_admin',
      is_platform_admin: false,
      active_tenant_id: tenantId,
      updated_at: knex.fn.now(),
    });
  } else {
    await knex('tenant_user_access').insert({
      id: randomUUID(),
      user_id: null,
      user_email: normalizedEmail,
      tenant_id: tenantId,
      role: 'tenant_admin',
      is_platform_admin: false,
      active_tenant_id: tenantId,
      is_auto_provisioned: false,
    });
  }

  const membership = await knex('tenant_membership')
    .where({ tenant_id: tenantId, user_email: normalizedEmail })
    .first();

  if (membership) {
    await knex('tenant_membership').where({ id: membership.id }).update({
      role: 'admin',
      status: 'active',
      updated_at: knex.fn.now(),
    });
  } else {
    await knex('tenant_membership').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_email: normalizedEmail,
      role: 'admin',
      status: 'active',
    });
  }

  return knex('tenant_user_access').where({ user_email: normalizedEmail }).first();
}

function getAuthCookieDomain(req: MedusaRequest): string | undefined {
  const host = req.get?.('host');

  if (!host) {
    return undefined;
  }

  const hostname = host.split(':')[0].toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || /^[0-9.]+$/.test(hostname)) {
    return undefined;
  }

  const segments = hostname.split('.').filter(Boolean);

  if (segments.length < 2) {
    return undefined;
  }

  return `.${segments.slice(-2).join('.')}`;
}

export function issueTenantAccessSessionCookie(
  req: MedusaRequest,
  res: MedusaResponse,
  input: { active_tenant_id: string | null; tenant_role?: string | null; is_platform_admin?: boolean }
) {
  const authContext = (req as any).auth_context || {};
  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any;
  const jwtSecret = configModule.projectConfig.http.jwtSecret;
  const jwtExpiresIn = configModule.projectConfig.http.jwtExpiresIn;
  const jwtOptions = configModule.projectConfig.http.jwtOptions;

  const appMetadata = {
    ...(authContext.app_metadata || {}),
    active_tenant_id: input.active_tenant_id,
    ...(input.tenant_role ? { tenant_role: input.tenant_role } : {}),
    ...(typeof input.is_platform_admin === 'boolean' ? { is_platform_admin: input.is_platform_admin } : {}),
  };

  const userMetadata = {
    ...(authContext.user_metadata || {}),
    active_tenant_id: input.active_tenant_id,
    ...(input.tenant_role ? { tenant_role: input.tenant_role } : {}),
    ...(typeof input.is_platform_admin === 'boolean' ? { is_platform_admin: input.is_platform_admin } : {}),
  };

  const token = generateJwtToken(
    {
      ...authContext,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    },
    {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
      jwtOptions,
    }
  );

  const cookieDomain = getAuthCookieDomain(req);

  res.cookie('medusa_auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    domain: cookieDomain,
  });
}
