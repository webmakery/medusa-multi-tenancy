import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import { AUDIT_LOG_MODULE } from '../audit-log';
import AuditLogModuleService from '../audit-log/service';
import TenantBillingAccount from './models/tenant-billing-account';
import TenantBillingEntitlement from './models/tenant-billing-entitlement';
import TenantBillingMeterEvent from './models/tenant-billing-meter-event';
import TenantBillingUsage from './models/tenant-billing-usage';
import { BILLING_PLAN_DEFINITIONS, DEFAULT_BILLING_PLAN_CODE } from './plans';

export type TenantBillingStatus = 'trialing' | 'active' | 'past_due' | 'grace_period' | 'suspended';

class BillingModuleService extends MedusaService({
  TenantBillingAccount,
  TenantBillingEntitlement,
  TenantBillingMeterEvent,
  TenantBillingUsage,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  private getAuditLogService(): AuditLogModuleService {
    return (this as any).__container__.resolve(AUDIT_LOG_MODULE) as AuditLogModuleService;
  }

  private computePeriodStart(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private computePeriodEnd(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  }

  private async syncEntitlementsForPlan(trx: Knex.Transaction, tenantId: string, planCode: string) {
    const plan = BILLING_PLAN_DEFINITIONS[planCode] || BILLING_PLAN_DEFINITIONS[DEFAULT_BILLING_PLAN_CODE];

    await trx('tenant_billing_entitlement').where({ tenant_id: tenantId }).del();

    await trx('tenant_billing_entitlement').insert(
      plan.entitlements.map((entitlement) => ({
        id: randomUUID(),
        tenant_id: tenantId,
        feature_key: entitlement.feature_key,
        is_enabled: entitlement.is_enabled,
        limit_value: entitlement.limit_value,
        meter_key: entitlement.meter_key || null,
        period: 'monthly',
      }))
    );
  }

  async ensureTenantBilling(tenantId: string) {
    const knex = this.getKnex();
    const existing = await knex('tenant_billing_account').where({ tenant_id: tenantId }).first();

    if (existing) {
      return existing;
    }

    const plan = BILLING_PLAN_DEFINITIONS[DEFAULT_BILLING_PLAN_CODE];
    const now = new Date();
    const periodStart = this.computePeriodStart(now);
    const periodEnd = this.computePeriodEnd(now);
    const trialEndsAt = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);

    await knex.transaction(async (trx) => {
      await trx('tenant_billing_account').insert({
        id: randomUUID(),
        tenant_id: tenantId,
        plan_code: plan.code,
        status: 'trialing',
        trial_starts_at: now,
        trial_ends_at: trialEndsAt,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        failed_payment_count: 0,
      });

      await this.syncEntitlementsForPlan(trx, tenantId, plan.code);
    });

    return knex('tenant_billing_account').where({ tenant_id: tenantId }).first();
  }

  async applyLifecycleTransitions(tenantId: string) {
    const knex = this.getKnex();
    await this.ensureTenantBilling(tenantId);

    const account = await knex('tenant_billing_account').where({ tenant_id: tenantId }).first();
    if (!account) return null;

    const now = new Date();
    const updates: Record<string, unknown> = {};

    if (account.status === 'trialing' && account.trial_ends_at && new Date(account.trial_ends_at).getTime() <= now.getTime()) {
      updates.status = 'past_due';
      updates.last_payment_failed_at = now;
      updates.grace_ends_at = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      updates.failed_payment_count = Number(account.failed_payment_count || 0) + 1;
    }

    if (
      (account.status === 'past_due' || account.status === 'grace_period')
      && account.grace_ends_at
      && new Date(account.grace_ends_at).getTime() <= now.getTime()
    ) {
      updates.status = 'suspended';
    }

    if (Object.keys(updates).length) {
      await knex('tenant_billing_account').where({ tenant_id: tenantId }).update({ ...updates, updated_at: knex.fn.now() });
    }

    return knex('tenant_billing_account').where({ tenant_id: tenantId }).first();
  }

  async assertEntitlement(input: { tenant_id: string; feature_key: string; quantity?: number }) {
    const knex = this.getKnex();
    const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;

    const account = await this.applyLifecycleTransitions(input.tenant_id);

    if (!account || account.status === 'suspended') {
      throw new Error('Billing account is suspended. Access is blocked until payment is recovered.');
    }

    const entitlement = await knex('tenant_billing_entitlement')
      .where({ tenant_id: input.tenant_id, feature_key: input.feature_key })
      .first();

    if (!entitlement || !entitlement.is_enabled) {
      throw new Error(`Feature "${input.feature_key}" is not enabled for this tenant plan.`);
    }

    if (entitlement.limit_value == null) {
      return { allowed: true, limit: null, used: null };
    }

    let used = 0;

    if (entitlement.meter_key) {
      const usage = await knex('tenant_billing_usage')
        .where({
          tenant_id: input.tenant_id,
          meter_key: entitlement.meter_key,
          period_start: account.current_period_start,
          period_end: account.current_period_end,
        })
        .first();

      used = Number(usage?.used_quantity || 0);
    } else if (input.feature_key === 'apps.installations') {
      const countResult = await knex('app_installation')
        .where({ tenant_id: input.tenant_id, status: 'installed' })
        .count<{ count: string }[]>({ count: '*' })
        .first();
      used = Number(countResult?.count || 0);
    }

    if (used + quantity > Number(entitlement.limit_value)) {
      throw new Error(`Plan limit reached for ${input.feature_key}: ${used}/${entitlement.limit_value}.`);
    }

    return {
      allowed: true,
      limit: Number(entitlement.limit_value),
      used,
    };
  }

  async recordMeteredEvent(input: {
    tenant_id: string;
    meter_key: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }) {
    const knex = this.getKnex();
    const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;

    const account = await this.applyLifecycleTransitions(input.tenant_id);

    if (!account || account.status === 'suspended') {
      throw new Error('Billing account is suspended. Metered events are blocked.');
    }

    const entitlement = await knex('tenant_billing_entitlement')
      .where({ tenant_id: input.tenant_id, meter_key: input.meter_key })
      .first();

    if (!entitlement || !entitlement.is_enabled) {
      throw new Error(`Meter ${input.meter_key} is not enabled for this tenant.`);
    }

    const periodStart = account.current_period_start || this.computePeriodStart();
    const periodEnd = account.current_period_end || this.computePeriodEnd();

    await knex.transaction(async (trx) => {
      const usageRow = await trx('tenant_billing_usage')
        .where({ tenant_id: input.tenant_id, meter_key: input.meter_key, period_start: periodStart, period_end: periodEnd })
        .first();

      const used = Number(usageRow?.used_quantity || 0);
      const limitValue = entitlement.limit_value == null ? null : Number(entitlement.limit_value);

      if (limitValue != null && used + quantity > limitValue) {
        throw new Error(`Plan limit reached for ${input.meter_key}: ${used}/${limitValue}.`);
      }

      if (usageRow) {
        await trx('tenant_billing_usage').where({ id: usageRow.id }).update({
          used_quantity: used + quantity,
          updated_at: trx.fn.now(),
        });
      } else {
        await trx('tenant_billing_usage').insert({
          id: randomUUID(),
          tenant_id: input.tenant_id,
          meter_key: input.meter_key,
          period_start: periodStart,
          period_end: periodEnd,
          used_quantity: quantity,
        });
      }

      await trx('tenant_billing_meter_event').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        meter_key: input.meter_key,
        quantity,
        metadata_json: input.metadata || null,
        occurred_at: trx.fn.now(),
      });
    });
  }

  async processRenewal(tenantId: string) {
    const knex = this.getKnex();
    await this.ensureTenantBilling(tenantId);
    const nextStart = this.computePeriodStart(new Date());
    const nextEnd = this.computePeriodEnd(new Date());

    await knex('tenant_billing_account').where({ tenant_id: tenantId }).update({
      status: 'active',
      current_period_start: nextStart,
      current_period_end: nextEnd,
      grace_ends_at: null,
      last_payment_failed_at: null,
      updated_at: knex.fn.now(),
    });

    return this.getBillingOverview(tenantId);
  }

  async markPaymentFailed(tenantId: string) {
    const knex = this.getKnex();
    await this.ensureTenantBilling(tenantId);
    const now = new Date();

    await knex('tenant_billing_account').where({ tenant_id: tenantId }).update({
      status: 'grace_period',
      last_payment_failed_at: now,
      grace_ends_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      failed_payment_count: knex.raw('failed_payment_count + 1'),
      updated_at: knex.fn.now(),
    });

    return this.getBillingOverview(tenantId);
  }

  async getBillingOverview(tenantId: string) {
    const knex = this.getKnex();
    const account = await this.applyLifecycleTransitions(tenantId);

    if (!account) {
      return null;
    }

    const [entitlements, usage] = await Promise.all([
      knex('tenant_billing_entitlement')
        .where({ tenant_id: tenantId })
        .orderBy('feature_key', 'asc'),
      knex('tenant_billing_usage')
        .where({ tenant_id: tenantId, period_start: account.current_period_start, period_end: account.current_period_end })
        .orderBy('meter_key', 'asc'),
    ]);

    return {
      account,
      entitlements,
      usage,
      state_transitions: {
        trial_to_past_due: 'Trial ends without payment method or successful renewal.',
        active_to_grace_period: 'Renewal payment fails, grace window starts.',
        grace_period_to_suspended: 'Grace window expires without payment recovery.',
        grace_period_to_active: 'Payment succeeds during grace and account renews.',
      },
    };
  }

  async recordAdminBillingAction(input: {
    tenant_id: string;
    actor?: string;
    action: 'renew' | 'payment_failed' | 'payment_recovered' | 'expire_grace';
    before_status?: TenantBillingStatus | null;
    after_status?: TenantBillingStatus | null;
    plan_code?: string | null;
  }) {
    await this.getAuditLogService().recordEvent({
      actor: input.actor || 'system',
      tenant_id: input.tenant_id,
      action: 'billing_status_changed',
      resource_id: input.tenant_id,
      payload: {
        billing_action: input.action,
        before_status: input.before_status || null,
        after_status: input.after_status || null,
        plan_code: input.plan_code || null,
      },
    });
  }
}

export default BillingModuleService;
