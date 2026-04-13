import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from 'knex';

import { TENANT_MANAGEMENT_MODULE } from '../../../modules/tenant-management';
import TenantManagementModuleService from '../../../modules/tenant-management/service';
import { resolveAuthenticatedTenantAccess } from '../_shared/tenant-access';

interface OnboardingChecklistItem {
  key: string;
  label: string;
  is_completed: boolean;
  hint?: string;
  action_label?: string;
  action_path?: string;
}

interface FunnelStepMetric {
  key: string;
  label: string;
  completed_count: number;
  conversion_rate: number;
  dropped_count: number;
  alert: 'ok' | 'warning';
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);
  const tenantAccess = await resolveAuthenticatedTenantAccess(req);

  if (tenantAccess.error) {
    return res.status(tenantAccess.error.status).json({ message: tenantAccess.error.message });
  }

  const tenant = await tenantManagementService.retrieveTenant(tenantAccess.tenantId!);
  const members = await tenantManagementService.listTenantMembers(tenantAccess.tenantId!);
  const knex = req.scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const salesChannelCountResult = await knex('sales_channel')
    .where({ tenant_id: tenantAccess.tenantId! })
    .whereNull('deleted_at')
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const salesChannelCount = Number(salesChannelCountResult?.count || 0);
  const acceptedInvitationsResult = await knex('tenant_invitation')
    .where({ tenant_id: tenantAccess.tenantId!, status: 'accepted' })
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const acceptedInvitationsCount = Number(acceptedInvitationsResult?.count || 0);
  const completedCheckoutResult = await knex('analytics_event')
    .where({ tenant_id: tenantAccess.tenantId!, event_type: 'checkout_completed' })
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const completedCheckoutCount = Number(completedCheckoutResult?.count || 0);
  const latestCompletedCheckout = await knex('analytics_event')
    .where({ tenant_id: tenantAccess.tenantId!, event_type: 'checkout_completed' })
    .orderBy('event_timestamp', 'asc')
    .first();
  const pendingWebhookCountResult = await knex('app_webhook')
    .where({ tenant_id: tenantAccess.tenantId!, is_active: true })
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const pendingWebhookCount = Number(pendingWebhookCountResult?.count || 0);
  const failedWebhookDeliveriesResult = await knex('app_webhook_delivery_log')
    .where({ tenant_id: tenantAccess.tenantId!, delivery_status: 'failed' })
    .where('created_at', '>=', knex.raw(`NOW() - INTERVAL '7 days'`))
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const failedWebhookDeliveries = Number(failedWebhookDeliveriesResult?.count || 0);
  const adminMembersResult = await knex('tenant_membership')
    .where({ tenant_id: tenantAccess.tenantId!, status: 'active' })
    .whereIn('role', ['owner', 'admin'])
    .count<{ count: string }[]>({ count: '*' })
    .first();
  const adminMembersCount = Number(adminMembersResult?.count || 0);
  const hasCustomDomain = Boolean(tenant?.slug && String(tenant.slug).includes('.'));
  const signupSession = await knex('tenant_signup_session').where({ tenant_id: tenantAccess.tenantId! }).first();
  const signupSubmitted = Boolean(signupSession);
  const emailVerified = Boolean(signupSession?.email_verified_at);
  const tenantCreated = Boolean(signupSession?.tenant_created_at);
  const ownerAssigned = Boolean(signupSession?.owner_assigned_at);
  const firstProjectSetup = Boolean(signupSession?.first_project_setup_at);
  const firstStepAt = signupSession?.created_at ? new Date(signupSession.created_at).getTime() : null;
  const staleWindowMs = 24 * 60 * 60 * 1000;
  const isStaleOnboarding =
    Boolean(signupSession) &&
    !firstProjectSetup &&
    Boolean(firstStepAt) &&
    Date.now() - (firstStepAt as number) > staleWindowMs;

  const checklist: OnboardingChecklistItem[] = [
    {
      key: 'signup_submitted',
      label: 'Sign up',
      hint: 'Create your account and start onboarding.',
      is_completed: signupSubmitted,
      action_label: 'Start signup',
      action_path: '/settings/store',
    },
    {
      key: 'email_verified',
      label: 'Verify email',
      hint: 'Confirm your email address to continue.',
      is_completed: emailVerified,
      action_label: 'Verify email',
      action_path: '/onboarding-status',
    },
    {
      key: 'tenant_created',
      label: 'Create workspace',
      hint: 'Provision your tenant workspace and defaults.',
      is_completed: tenantCreated,
      action_label: 'Review workspace',
      action_path: '/settings/store',
    },
    {
      key: 'owner_assigned',
      label: 'Assign owner access',
      hint: 'Ensure owner permissions are active.',
      is_completed: ownerAssigned,
      action_label: 'Manage members',
      action_path: '/team-members',
    },
    {
      key: 'first_project_setup',
      label: 'Complete first project/site setup',
      hint: 'Use the setup wizard to configure your first project.',
      is_completed: firstProjectSetup,
      action_label: 'Open setup wizard',
      action_path: '/onboarding-status',
    },
  ];

  const completedCounts = checklist.reduce(
    (acc, item, index) => {
      acc[index] = item.is_completed ? 1 : 0;
      return acc;
    },
    [] as number[]
  );

  const funnelSteps: FunnelStepMetric[] = checklist.map((item, index) => {
    const previousCompleted = index === 0 ? 1 : completedCounts[index - 1];
    const currentCompleted = completedCounts[index];
    const conversionRate = previousCompleted > 0 ? currentCompleted / previousCompleted : 0;
    const droppedCount = Math.max(previousCompleted - currentCompleted, 0);

    return {
      key: item.key,
      label: item.label,
      completed_count: currentCompleted,
      conversion_rate: Number(conversionRate.toFixed(4)),
      dropped_count: droppedCount,
      alert: conversionRate < 0.7 ? 'warning' : 'ok',
    };
  });

  res.status(200).json({
    count: checklist.length,
    completed: checklist.filter((item) => item.is_completed).length,
    checklist,
    funnel: {
      signup_completed: checklist.find((item) => item.key === 'signup_submitted')?.is_completed ?? false,
      email_verified: checklist.find((item) => item.key === 'email_verified')?.is_completed ?? false,
      tenant_created: checklist.find((item) => item.key === 'tenant_created')?.is_completed ?? false,
      owner_assigned: checklist.find((item) => item.key === 'owner_assigned')?.is_completed ?? false,
      first_project_setup_completed: checklist.find((item) => item.key === 'first_project_setup')?.is_completed ?? false,
      team_invited: members.length > 1 || acceptedInvitationsCount > 0,
      first_value_action_completed: completedCheckoutCount > 0,
      first_value_at: latestCompletedCheckout?.event_timestamp || null,
      steps: funnelSteps,
      drop_off_alerts: [
        ...(isStaleOnboarding
          ? [
              {
                key: 'stale_onboarding',
                severity: 'warning',
                detail: 'Setup has not completed within 24 hours of signup.',
              },
            ]
          : []),
        ...funnelSteps
          .filter((step) => step.alert === 'warning')
          .map((step) => ({
            key: `dropoff_${step.key}`,
            severity: 'warning',
            detail: `Drop-off detected at ${step.label}.`,
          })),
      ],
    },
    diagnostics: [
      {
        key: 'domain',
        label: 'Domain setup',
        status: hasCustomDomain ? 'ok' : 'blocked',
        detail: hasCustomDomain ? 'Custom domain detected.' : 'No custom domain detected on tenant slug.',
      },
      {
        key: 'webhooks',
        label: 'Webhook health',
        status: pendingWebhookCount > 0 && failedWebhookDeliveries === 0 ? 'ok' : 'blocked',
        detail:
          pendingWebhookCount === 0
            ? 'No active webhook endpoints are configured.'
            : failedWebhookDeliveries > 0
              ? `${failedWebhookDeliveries} webhook deliveries failed in the last 7 days.`
              : 'Webhook deliveries are healthy.',
      },
      {
        key: 'permissions',
        label: 'Admin permissions coverage',
        status: adminMembersCount > 0 ? 'ok' : 'blocked',
        detail:
          adminMembersCount > 0
            ? `${adminMembersCount} admin-level member(s) can manage setup.`
            : 'No active owner/admin member found.',
      },
    ],
  });
}
