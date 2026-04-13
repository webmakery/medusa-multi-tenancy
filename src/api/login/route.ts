import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';
import { TENANT_MANAGEMENT_MODULE } from '../../modules/tenant-management';
import TenantManagementModuleService from '../../modules/tenant-management/service';

interface LoginBody {
  email?: string;
  password?: string;
}

const PLATFORM_ADMIN_AUTH_METADATA_KEYS = [
  'platform_operator',
  'is_platform_operator',
  'is_admin',
  'admin',
] as const;

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

function isPlatformAdmin(authIdentity?: Record<string, any>): boolean {
  const appMetadata = authIdentity?.app_metadata;

  if (!appMetadata || typeof appMetadata !== 'object') {
    return false;
  }

  return PLATFORM_ADMIN_AUTH_METADATA_KEYS.some((key) => isTruthy(appMetadata[key]));
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as LoginBody;

  if (!body.email?.trim() || !body.password?.trim()) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const authService = req.scope.resolve(Modules.AUTH) as IAuthModuleService;
  const authResult = await authService.authenticate('emailpass', {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: {
      email: body.email.trim().toLowerCase(),
      password: body.password,
    },
    protocol: req.protocol,
  });

  if (!authResult.success) {
    return res.status(401).json({ message: authResult.error || 'Invalid email or password.' });
  }

  const normalizedEmail = body.email.trim().toLowerCase();
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const memberships = await tenantManagementService.listActiveMembershipsByEmail(normalizedEmail);
  const platformAdmin = isPlatformAdmin(authResult.authIdentity as Record<string, any> | undefined);
  const tenantMembershipCount = memberships.length;
  const singleMembership = memberships[0];

  let redirectTo = '/tenant-picker';

  if (platformAdmin) {
    redirectTo = '/platform-admin';
  } else if (tenantMembershipCount === 1 && singleMembership?.tenant_slug) {
    redirectTo = `/t/${singleMembership.tenant_slug}`;
  }

  return res.status(200).json({
    status: 'authenticated',
    auth_identity_id: authResult.authIdentity?.id,
    platform_admin: platformAdmin,
    memberships,
    redirect_to: redirectTo,
  });
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.redirect(302, '/app/login');
}
