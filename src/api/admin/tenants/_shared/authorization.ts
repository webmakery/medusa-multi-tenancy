import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../modules/tenant-management';
import TenantManagementModuleService, { TenantRole } from '../../../../modules/tenant-management/service';

type TenantAction = 'invite' | 'manage_members' | 'deactivate_tenant';

const ACTION_PERMISSIONS: Record<TenantAction, TenantRole[]> = {
  invite: ['owner', 'admin'],
  manage_members: ['owner', 'admin'],
  deactivate_tenant: ['owner'],
};

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

export async function authorizeTenantAction(
  req: MedusaRequest,
  res: MedusaResponse,
  action: TenantAction
): Promise<{ allowed: boolean; actorRole?: TenantRole }> {
  const { tenant_id } = req.params;

  if (!tenant_id) {
    res.status(400).json({ message: 'tenant_id is required' });
    return { allowed: false };
  }

  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    res.status(401).json({ message: 'Authenticated user email is required for tenant authorization.' });
    return { allowed: false };
  }

  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const membership = await tenantManagementService.getTenantMembershipByEmail({
    tenant_id,
    user_email: actorEmail,
  });

  if (!membership || membership.status !== 'active') {
    res.status(403).json({ message: 'You are not an active member of this tenant.' });
    return { allowed: false };
  }

  const allowedRoles = ACTION_PERMISSIONS[action];

  if (!allowedRoles.includes(membership.role)) {
    res.status(403).json({
      message: `Insufficient permissions for ${action}. Required role: ${allowedRoles.join(' or ')}.`,
    });
    return { allowed: false };
  }

  return { allowed: true, actorRole: membership.role };
}
