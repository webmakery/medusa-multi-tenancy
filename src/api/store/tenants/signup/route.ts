import { createHash, randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { ANALYTICS_MODULE } from '../../../../modules/analytics';
import AnalyticsModuleService from '../../../../modules/analytics/service';

interface SignupBody {
  name?: string;
  slug?: string;
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
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
    const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
    const analyticsService = req.scope.resolve<AnalyticsModuleService>(ANALYTICS_MODULE);
    const verificationToken = randomUUID();
    const verificationTokenHash = createHash('sha256').update(verificationToken).digest('hex');
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await knex('tenant_signup_session')
      .insert({
        id: sessionId,
        tenant_name: body.name.trim(),
        tenant_slug: slug,
        owner_email: ownerEmail,
        password_secret: body.password.trim(),
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim() || null,
        verification_token_hash: verificationTokenHash,
        verification_expires_at: expiresAt.toISOString(),
        current_step: 'signup_submitted',
      })
      .onConflict('owner_email')
      .merge({
        tenant_name: body.name.trim(),
        tenant_slug: slug,
        password_secret: body.password.trim(),
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim() || null,
        verification_token_hash: verificationTokenHash,
        verification_expires_at: expiresAt.toISOString(),
        current_step: 'signup_submitted',
        updated_at: knex.fn.now(),
      });

    await analyticsService.recordEvent({
      tenant_id: sessionId,
      event_type: 'session_started',
      metadata: {
        channel: 'tenant_signup',
        campaign: 'signup_submitted',
        actor_hash: createHash('sha256').update(ownerEmail).digest('hex').slice(0, 16),
      },
    });

    return res.status(200).json({
      status: 'verification_required',
      session_id: sessionId,
      verification: {
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
      },
      next_step: 'verify_email',
      checklist: [
        { key: 'signup_submitted', label: 'Sign up', is_completed: true },
        { key: 'email_verified', label: 'Verify your email', is_completed: false },
        { key: 'tenant_created', label: 'Create your workspace', is_completed: false },
        { key: 'owner_assigned', label: 'Assign owner access', is_completed: false },
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
