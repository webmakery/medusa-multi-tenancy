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

  const checklist: OnboardingChecklistItem[] = [
    {
      key: 'signup',
      label: 'Complete signup',
      hint: 'Finish account details to unlock setup features.',
      is_completed: Boolean(tenant?.name),
      action_label: 'Complete profile',
      action_path: '/settings/store',
    },
    {
      key: 'invite_team',
      label: 'Invite team member',
      hint: 'Invite at least one teammate so setup does not rely on a single owner.',
      is_completed: members.length > 1 || acceptedInvitationsCount > 0,
      action_label: 'Invite team',
      action_path: '/team-members',
    },
    {
      key: 'first_value_action',
      label: 'Complete first value action',
      hint: 'Track the first completed checkout to verify value delivery.',
      is_completed: completedCheckoutCount > 0,
      action_label: 'View analytics',
      action_path: '/analytics',
    },
    {
      key: 'launch_readiness',
      label: 'Review launch readiness',
      hint: 'Validate core setup blockers before launch.',
      is_completed: salesChannelCount > 0 && pendingWebhookCount > 0 && adminMembersCount > 0,
      action_label: 'Open diagnostics',
      action_path: '/onboarding-status',
    },
  ];

  res.status(200).json({
    count: checklist.length,
    completed: checklist.filter((item) => item.is_completed).length,
    checklist,
    funnel: {
      signup_completed: checklist.find((item) => item.key === 'signup')?.is_completed ?? false,
      team_invited: checklist.find((item) => item.key === 'invite_team')?.is_completed ?? false,
      first_value_action_completed: checklist.find((item) => item.key === 'first_value_action')?.is_completed ?? false,
      first_value_at: latestCompletedCheckout?.event_timestamp || null,
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
