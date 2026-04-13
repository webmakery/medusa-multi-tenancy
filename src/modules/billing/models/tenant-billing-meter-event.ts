import { model } from '@medusajs/framework/utils';

const TenantBillingMeterEvent = model.define('tenant_billing_meter_event', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  meter_key: model.text(),
  quantity: model.number().default(1),
  metadata_json: model.json().nullable(),
  occurred_at: model.dateTime(),
});

export default TenantBillingMeterEvent;
