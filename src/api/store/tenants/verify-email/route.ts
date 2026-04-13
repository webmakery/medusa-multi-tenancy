import { createHash } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, generateJwtToken } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';
import { createUserAccountWorkflow } from '@medusajs/medusa/core-flows';

import { ANALYTICS_MODULE } from '../../../../modules/analytics';
import AnalyticsModuleService from '../../../../modules/analytics/service';
import createTenantOnboardingWorkflow from '../../../../workflows/tenant/create-tenant';

interface VerifyEmailBody {
  token?: string;
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
  const body = (req.body || {}) as VerifyEmailBody;

  if (!body.token?.trim()) {
    return res.status(400).json({ message: 'token is required' });
  }

  const tokenHash = createHash('sha256').update(body.token.trim()).digest('hex');
  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const analyticsService = req.scope.resolve<AnalyticsModuleService>(ANALYTICS_MODULE);

  const session = await knex('tenant_signup_session').where({ verification_token_hash: tokenHash }).first();

  if (!session) {
    return res.status(404).json({ message: 'Verification session not found.' });
  }

  if (session.current_step !== 'signup_submitted') {
    return res.status(409).json({ message: 'Email verification already completed for this session.' });
  }

  if (new Date(session.verification_expires_at).getTime() < Date.now()) {
    return res.status(410).json({ message: 'Verification token has expired.' });
  }

  if (!session.password_secret) {
    return res.status(409).json({ message: 'Signup session is missing credentials. Please restart signup.' });
  }

  try {
    const { result } = await createTenantOnboardingWorkflow(req.scope).run({
      input: {
        name: session.tenant_name,
        slug: session.tenant_slug,
        owner_email: session.owner_email,
      },
      context: {
        idempotencyKey: `store-tenant-signup:${session.tenant_slug}:${session.owner_email}`,
      },
    });

    const authService = req.scope.resolve(Modules.AUTH) as IAuthModuleService;
    const authRegistration = await authService.register('emailpass', {
      url: req.url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      body: {
        email: session.owner_email,
        password: session.password_secret,
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
          email: session.owner_email,
          first_name: session.first_name || session.tenant_name,
          last_name: session.last_name || undefined,
        },
      },
    });

    const authIdentity = await authService.retrieveAuthIdentity(authRegistration.authIdentity.id);
    const existingAppMetadata = (authIdentity?.app_metadata || {}) as Record<string, unknown>;

    await authService.updateAuthIdentities({
      id: authRegistration.authIdentity.id,
      app_metadata: {
        ...existingAppMetadata,
        platform_operator: false,
        is_platform_operator: false,
        is_admin: false,
        admin: false,
        active_tenant_id: result.tenant.tenant_id,
        tenant_role: 'owner',
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
          active_tenant_id: result.tenant.tenant_id,
          tenant_role: 'owner',
        },
        user_metadata: {
          email: session.owner_email,
          tenant_id: result.tenant.tenant_id,
          active_tenant_id: result.tenant.tenant_id,
          tenant_slug: result.tenant.slug,
          tenant_role: 'owner',
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

    await knex('tenant_signup_session').where({ id: session.id }).update({
      tenant_id: result.tenant.tenant_id,
      owner_user_id: ownerUser.id,
      email_verified_at: knex.fn.now(),
      tenant_created_at: knex.fn.now(),
      owner_assigned_at: knex.fn.now(),
      current_step: 'owner_assigned',
      password_secret: null,
      updated_at: knex.fn.now(),
    });

    await analyticsService.recordEvent({
      tenant_id: result.tenant.tenant_id,
      event_type: 'checkout_started',
      metadata: {
        channel: 'tenant_onboarding',
        campaign: 'email_verified',
      },
    });
    await analyticsService.recordEvent({
      tenant_id: result.tenant.tenant_id,
      event_type: 'checkout_started',
      metadata: {
        channel: 'tenant_onboarding',
        campaign: 'tenant_created',
      },
    });
    await analyticsService.recordEvent({
      tenant_id: result.tenant.tenant_id,
      event_type: 'checkout_started',
      metadata: {
        channel: 'tenant_onboarding',
        campaign: 'owner_assigned',
      },
    });

    return res.status(200).json({
      status: 'verified',
      tenant: result.tenant,
      token,
      token_storage_key: 'medusa_auth_token',
      auth: {
        token,
        storage_key: 'medusa_auth_token',
      },
      next_step: 'setup_wizard',
      checklist: [
        { key: 'signup_submitted', label: 'Sign up', is_completed: true },
        { key: 'email_verified', label: 'Verify your email', is_completed: true },
        { key: 'tenant_created', label: 'Create your workspace', is_completed: true },
        { key: 'owner_assigned', label: 'Assign owner access', is_completed: true },
        { key: 'first_project_setup', label: 'Set up your first project', is_completed: false },
      ],
    });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }

    throw error;
  }
}
