import { model } from '@medusajs/framework/utils';

const AnalyticsEvent = model.define('analytics_event', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  event_type: model.text(),
  event_timestamp: model.dateTime(),
  event_date: model.dateTime(),
  session_id: model.text().nullable(),
  order_id: model.text().nullable(),
  currency_code: model.text().nullable(),
  amount_cents: model.number().nullable(),
  items: model.json().nullable(),
  metadata: model.json().nullable(),
  processed_at: model.dateTime().nullable(),
});

export default AnalyticsEvent;
