import { model } from '@medusajs/framework/utils';

const TenantBillingUsage = model.define('tenant_billing_usage', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  meter_key: model.text(),
  period_start: model.dateTime(),
  period_end: model.dateTime(),
  used_quantity: model.number().default(0),
});

export default TenantBillingUsage;
