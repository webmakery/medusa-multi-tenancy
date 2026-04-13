import { model } from '@medusajs/framework/utils';

const TenantBillingEntitlement = model.define('tenant_billing_entitlement', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  feature_key: model.text(),
  is_enabled: model.boolean().default(true),
  limit_value: model.number().nullable(),
  meter_key: model.text().nullable(),
  period: model.enum(['monthly']).default('monthly'),
});

export default TenantBillingEntitlement;
