import { model } from '@medusajs/framework/utils';

const ThemeMetadata = model.define('theme_metadata', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  name: model.text(),
  slug: model.text(),
  version: model.text().default('1.0.0'),
  author: model.text().nullable(),
  description: model.text().nullable(),
  is_active: model.boolean().default(false),
});

export default ThemeMetadata;
