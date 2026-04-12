import { model } from '@medusajs/framework/utils';

const AppWebhook = model.define('app_webhook', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  app_id: model.text(),
  event_name: model.text(),
  target_url: model.text(),
  is_active: model.boolean().default(true),
});

export default AppWebhook;
