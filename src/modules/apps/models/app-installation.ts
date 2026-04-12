import { model } from '@medusajs/framework/utils';

const AppInstallation = model.define('app_installation', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  app_name: model.text(),
  app_identifier: model.text(),
  app_url: model.text().nullable(),
  status: model.text().default('installed'),
  installed_at: model.dateTime(),
  uninstalled_at: model.dateTime().nullable(),
});

export default AppInstallation;
