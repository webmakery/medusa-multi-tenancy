import { MedusaRequest } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../utils/tenant';
import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';

function getActorEmail(req: MedusaRequest): string | null {
  const authContext = (req as any).auth_context;

  const possibleEmails = [
    authContext?.actor_email,
    authContext?.email,
    authContext?.actor_id,
    authContext?.actor?.email,
    authContext?.auth_identity?.app_metadata?.email,
    req.headers['x-user-email'],
  ];

  for (const value of possibleEmails) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized.includes('@')) {
        return normalized;
      }
    }
  }

  return null;
}

export async function resolveAuthenticatedTenantAccess(req: MedusaRequest): Promise<{
  tenantId?: string;
  actorEmail?: string;
  error?: { status: number; message: string };
}> {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return {
      error: { status: 400, message: 'x-tenant-id header (or tenant_id query in development) is required' },
    };
  }

  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    return {
      error: { status: 401, message: 'Authenticated user email is required for tenant authorization.' },
    };
  }

  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const membership = await tenantManagementService.getTenantMembershipByEmail({
    tenant_id: tenantId,
    user_email: actorEmail,
  });

  if (!membership || membership.status !== 'active') {
    return {
      error: { status: 403, message: 'You are not an active member of this tenant.' },
    };
  }

  return {
    tenantId,
    actorEmail,
  };
}
