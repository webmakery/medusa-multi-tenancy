import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, generateJwtToken } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';
import { createUserAccountWorkflow } from '@medusajs/medusa/core-flows';

import createTenantOnboardingWorkflow from '../../../../workflows/tenant/create-tenant';

interface SignupBody {
  name?: string;
  slug?: string;
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  redirect_to?: string;
}

const SLUG_MAX_LENGTH = 60;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}

function getSafeRedirectPath(path?: string): string {
  if (!path || typeof path !== 'string') {
    return '/app';
  }

  const normalized = path.trim();

  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/app';
  }

  return normalized;
}

function getAuthCookieDomain(req: MedusaRequest): string | undefined {
  const host = (req.headers.host || '').toString().split(':')[0].trim().toLowerCase();

  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host)) {
    return undefined;
  }

  const segments = host.split('.').filter(Boolean);

  if (segments.length < 2) {
    return undefined;
  }

  return `.${segments.slice(-2).join('.')}`;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as SignupBody;

  if (!body.name?.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!body.email?.trim()) {
    return res.status(400).json({ message: 'email is required' });
  }

  if (!body.password?.trim() || body.password.trim().length < 8) {
    return res.status(400).json({ message: 'password must be at least 8 characters' });
  }

  const slug = slugify(body.slug || body.name);

  if (!slug) {
    return res.status(400).json({ message: 'Could not generate a valid slug from name/slug.' });
  }

  const ownerEmail = body.email.trim().toLowerCase();

  try {
    const { result } = await createTenantOnboardingWorkflow(req.scope).run({
      input: {
        name: body.name.trim(),
        slug,
        owner_email: ownerEmail,
      },
      context: {
        idempotencyKey: `store-tenant-signup:${slug}:${ownerEmail}`,
      },
    });

    const authService = req.scope.resolve(Modules.AUTH) as IAuthModuleService;
    const authRegistration = await authService.register('emailpass', {
      url: req.url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      body: {
        email: ownerEmail,
        password: body.password.trim(),
      },
      protocol: req.protocol,
    });

    if (!authRegistration.success || !authRegistration.authIdentity?.id) {
      throw new Error(authRegistration.error || 'Failed to create auth identity for owner.');
    }

    const { result: ownerUser } = await createUserAccountWorkflow(req.scope).run({
      input: {
        authIdentityId: authRegistration.authIdentity.id,
        userData: {
          email: ownerEmail,
          first_name: body.first_name?.trim() || body.name.trim(),
          last_name: body.last_name?.trim() || undefined,
        },
      },
    });

    const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any;
    const jwtSecret = configModule.projectConfig.http.jwtSecret;
    const jwtExpiresIn = configModule.projectConfig.http.jwtExpiresIn;
    const jwtOptions = configModule.projectConfig.http.jwtOptions;

    const token = generateJwtToken(
      {
        actor_id: ownerUser.id,
        actor_type: 'user',
        auth_identity_id: authRegistration.authIdentity.id,
        app_metadata: {
          user_id: ownerUser.id,
        },
        user_metadata: {
          email: ownerEmail,
          tenant_id: result.tenant.tenant_id,
          tenant_slug: result.tenant.slug,
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

    const redirectPath = getSafeRedirectPath(body.redirect_to);
    const redirectUrl = `${redirectPath}${redirectPath.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(
      result.tenant.slug
    )}`;

    return res.redirect(303, redirectUrl);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }

    if (error.message?.toLowerCase().includes('password')) {
      return res.status(400).json({ message: error.message });
    }

    throw error;
  }
}
