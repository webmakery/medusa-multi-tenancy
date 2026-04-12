import { model } from '@medusajs/framework/utils';

const AppCredential = model.define('app_credential', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  app_id: model.text(),
  key_id: model.text(),
  secret: model.text(),
  is_active: model.boolean().default(true),
  rotated_at: model.dateTime().nullable(),
});

export default AppCredential;
