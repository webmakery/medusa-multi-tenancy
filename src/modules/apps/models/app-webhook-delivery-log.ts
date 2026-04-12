import { model } from '@medusajs/framework/utils';

const AppWebhookDeliveryLog = model.define('app_webhook_delivery_log', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  app_id: model.text(),
  event_name: model.text(),
  target_url: model.text(),
  delivery_status: model.text(),
  attempt_number: model.number(),
  response_status: model.number().nullable(),
  error_message: model.text().nullable(),
  delivered_at: model.dateTime(),
});

export default AppWebhookDeliveryLog;
