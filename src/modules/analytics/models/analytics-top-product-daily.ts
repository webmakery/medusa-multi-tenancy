import { model } from '@medusajs/framework/utils';

const AnalyticsTopProductDaily = model.define('analytics_top_product_daily', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  rollup_date: model.dateTime(),
  product_id: model.text(),
  product_title: model.text().nullable(),
  quantity: model.number().default(0),
  gmv_cents: model.number().default(0),
  rank: model.number().default(0),
});

export default AnalyticsTopProductDaily;
