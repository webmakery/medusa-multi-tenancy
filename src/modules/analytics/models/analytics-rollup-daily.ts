import { model } from '@medusajs/framework/utils';

const AnalyticsRollupDaily = model.define('analytics_rollup_daily', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  rollup_date: model.dateTime(),
  currency_code: model.text().nullable(),
  sessions_count: model.number().default(0),
  checkout_started_count: model.number().default(0),
  checkout_completed_count: model.number().default(0),
  orders_count: model.number().default(0),
  gmv_cents: model.number().default(0),
  aov_cents: model.number().default(0),
  conversion_proxy: model.number().default(0),
});

export default AnalyticsRollupDaily;
