import { model } from '@medusajs/framework/utils';

const ThemeConfig = model.define('theme_config', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  theme_id: model.text(),
  config_json: model.json(),
});

export default ThemeConfig;
