import { model } from '@medusajs/framework/utils';

const TenantBillingAccount = model.define('tenant_billing_account', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  plan_code: model.text(),
  status: model.enum(['trialing', 'active', 'past_due', 'grace_period', 'suspended']).default('trialing'),
  trial_starts_at: model.dateTime().nullable(),
  trial_ends_at: model.dateTime().nullable(),
  current_period_start: model.dateTime(),
  current_period_end: model.dateTime(),
  grace_ends_at: model.dateTime().nullable(),
  last_payment_failed_at: model.dateTime().nullable(),
  failed_payment_count: model.number().default(0),
});

export default TenantBillingAccount;
