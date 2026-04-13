import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, generateJwtToken } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';

interface LoginBody {
  email?: string;
  password?: string;
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

  if (!authResult.success || !authResult.authIdentity?.id) {
    return res.status(401).json({ message: authResult.error || 'Invalid email or password.' });
  }

  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any;
  const jwtSecret = configModule.projectConfig.http.jwtSecret;
  const jwtExpiresIn = configModule.projectConfig.http.jwtExpiresIn;
  const jwtOptions = configModule.projectConfig.http.jwtOptions;

  const authIdentityAppMetadata = authResult.authIdentity.app_metadata || {};

  const token = generateJwtToken(
    {
      auth_identity_id: authResult.authIdentity.id,
      app_metadata: authIdentityAppMetadata,
      user_metadata: {
        email: body.email.trim().toLowerCase(),
        ...(authIdentityAppMetadata.active_tenant_id ? { active_tenant_id: authIdentityAppMetadata.active_tenant_id } : {}),
        ...(authIdentityAppMetadata.tenant_role ? { tenant_role: authIdentityAppMetadata.tenant_role } : {}),
      },
      ...(authIdentityAppMetadata.user_id
        ? {
            actor_id: authIdentityAppMetadata.user_id,
            actor_type: 'user',
          }
        : {}),
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

  return res.status(200).json({
    status: 'authenticated',
    auth_identity_id: authResult.authIdentity.id,
  });
}
