import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, generateJwtToken } from '@medusajs/framework/utils';

import { getActiveTenantIdFromAuthContext, getActorEmail } from '../../_shared/auth-context';
import { TENANT_MANAGEMENT_MODULE } from '../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../modules/tenant-management/service';

interface SelectActiveTenantBody {
  tenant_id?: string;
}

function getAuthCookieDomain(req: MedusaRequest): string | undefined {
  const host = req.get?.('host');

  if (!host) {
    return undefined;
  }

  const hostname = host.split(':')[0].toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^[0-9.]+$/.test(hostname)
  ) {
    return undefined;
  }

  const segments = hostname.split('.').filter(Boolean);

  if (segments.length < 2) {
    return undefined;
  }

  return `.${segments.slice(-2).join('.')}`;
}

async function listActorMemberships(req: MedusaRequest, actorEmail: string) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  return tenantManagementService.listActiveMembershipsByEmail(actorEmail);
}

function issueUpdatedSessionCookie(req: MedusaRequest, res: MedusaResponse, tenantId: string, tenantRole?: string) {
  const authContext = (req as any).auth_context || {};
  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any;
  const jwtSecret = configModule.projectConfig.http.jwtSecret;
  const jwtExpiresIn = configModule.projectConfig.http.jwtExpiresIn;
  const jwtOptions = configModule.projectConfig.http.jwtOptions;

  const token = generateJwtToken(
    {
      ...authContext,
      app_metadata: {
        ...(authContext.app_metadata || {}),
        active_tenant_id: tenantId,
        ...(tenantRole ? { tenant_role: tenantRole } : {}),
      },
      user_metadata: {
        ...(authContext.user_metadata || {}),
        active_tenant_id: tenantId,
        ...(tenantRole ? { tenant_role: tenantRole } : {}),
      },
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  const memberships = await listActorMemberships(req, actorEmail);
  const activeTenantId = getActiveTenantIdFromAuthContext(req);

  return res.status(200).json({
    active_tenant_id: activeTenantId,
    memberships,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorEmail = getActorEmail(req);

  if (!actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  const body = (req.body || {}) as SelectActiveTenantBody;
  const tenantId = body.tenant_id?.trim();

  if (!tenantId) {
    return res.status(400).json({ message: 'tenant_id is required' });
  }

  const memberships = await listActorMemberships(req, actorEmail);
  const membership = memberships.find((entry) => entry.tenant_id === tenantId);

  if (!membership) {
    return res.status(403).json({ message: 'You are not an active member of this tenant.' });
  }

  issueUpdatedSessionCookie(req, res, tenantId, membership.role);

  return res.status(200).json({
    active_tenant_id: tenantId,
    membership,
  });
}
