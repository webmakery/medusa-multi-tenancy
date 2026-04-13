import { MedusaRequest } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../utils/tenant';
import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService, { TenantRole } from '../../../modules/tenant-management/service';
import { isTenantAccessBlocked } from '../../../modules/tenant-management/lifecycle';
import { getActiveTenantIdFromAuthContext, getActorEmail, getTenantRoleFromAuthContext } from './auth-context';
import { resolveTenantUserAccess } from './tenant-user-access';

export async function resolveAuthenticatedTenantAccess(req: MedusaRequest): Promise<{
  tenantId?: string;
  actorEmail?: string;
  actorRole?: TenantRole;
  error?: { status: number; message: string };
}> {
  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    return {
      error: { status: 401, message: 'Authenticated user email is required for tenant authorization.' },
    };
  }

  const resolvedAccess = await resolveTenantUserAccess(req);
  const tenantId = resolvedAccess.effectiveTenantId || getTenantIdFromRequest(req);

  if (!tenantId) {
    return {
      error: { status: 403, message: 'Tenant access is not assigned for this authenticated user.' },
    };
  }

  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const activeMemberships = await tenantManagementService.listActiveMembershipsByEmail(actorEmail);
  const activeTenantIdFromSession = getActiveTenantIdFromAuthContext(req);

  if (activeMemberships.length > 1 && activeTenantIdFromSession && activeTenantIdFromSession !== tenantId) {
    return {
      error: {
        status: 409,
        message: 'Tenant mismatch. Switch your active tenant first to prevent cross-tenant account confusion.',
      },
    };
  }

  const membership = await tenantManagementService.getTenantMembershipByEmail({
    tenant_id: tenantId,
    user_email: actorEmail,
  });

  if (!membership || membership.status !== 'active') {
    return {
      error: { status: 403, message: 'You are not an active member of this tenant.' },
    };
  }

  const tenantStatus = await tenantManagementService.getTenantStatus(tenantId);

  if (isTenantAccessBlocked(tenantStatus)) {
    return {
      error: {
        status: 423,
        message: `Tenant access is blocked while status is "${tenantStatus || 'unknown'}".`,
      },
    };
  }

  const actorRole = (membership.role || getTenantRoleFromAuthContext(req)) as TenantRole;

  return {
    tenantId,
    actorEmail,
    actorRole,
  };
}

export function hasTenantRole(access: { actorRole?: TenantRole }, allowedRoles: TenantRole[]): boolean {
  return Boolean(access.actorRole && allowedRoles.includes(access.actorRole));
}

export function requireTenantRole(
  access: { actorRole?: TenantRole },
  allowedRoles: TenantRole[]
): { ok: true } | { ok: false; status: number; message: string } {
  if (hasTenantRole(access, allowedRoles)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
  };
}
