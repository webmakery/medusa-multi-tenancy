import { model } from '@medusajs/framework/utils';

const AppScope = model.define('app_scope', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  app_id: model.text(),
  scope: model.text(),
});

export default AppScope;
