import type { Knex } from 'knex';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { ANALYTICS_MODULE } from '../../../../modules/analytics';
import AnalyticsModuleService from '../../../../modules/analytics/service';

interface SetupWizardBody {
  tenant_id?: string;
  project_name?: string;
  site_name?: string;
  site_url?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as SetupWizardBody;

  if (!body.tenant_id?.trim()) {
    return res.status(400).json({ message: 'tenant_id is required' });
  }

  if (!body.project_name?.trim() || !body.site_name?.trim()) {
    return res.status(400).json({ message: 'project_name and site_name are required' });
  }

  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const analyticsService = req.scope.resolve<AnalyticsModuleService>(ANALYTICS_MODULE);

  const session = await knex('tenant_signup_session').where({ tenant_id: body.tenant_id.trim() }).first();

  if (!session) {
    return res.status(404).json({ message: 'Onboarding session not found for this tenant.' });
  }

  await knex('tenant')
    .where({ tenant_id: body.tenant_id.trim() })
    .update({
      settings_json: knex.raw(
        `jsonb_set(
          jsonb_set(
            COALESCE(settings_json, '{}'::jsonb),
            '{first_project}',
            to_jsonb(?::text),
            true
          ),
          '{first_site}',
          to_jsonb(?::jsonb),
          true
        )`,
        [
          body.project_name.trim(),
          JSON.stringify({
            name: body.site_name.trim(),
            url: body.site_url?.trim() || null,
          }),
        ]
      ),
      updated_at: knex.fn.now(),
    });

  await knex('tenant_signup_session').where({ id: session.id }).update({
    first_project_setup_at: knex.fn.now(),
    current_step: 'first_project_setup',
    updated_at: knex.fn.now(),
  });

  await analyticsService.recordEvent({
    tenant_id: body.tenant_id.trim(),
    event_type: 'checkout_completed',
    metadata: {
      channel: 'tenant_onboarding',
      campaign: 'setup_wizard_completed',
    },
  });

  return res.status(200).json({
    status: 'completed',
    next_step: 'launch',
    checklist: [
      { key: 'signup_submitted', label: 'Sign up', is_completed: true },
      { key: 'email_verified', label: 'Verify your email', is_completed: true },
      { key: 'tenant_created', label: 'Create your workspace', is_completed: true },
      { key: 'owner_assigned', label: 'Assign owner access', is_completed: true },
      { key: 'first_project_setup', label: 'Set up your first project', is_completed: true },
    ],
  });
}
