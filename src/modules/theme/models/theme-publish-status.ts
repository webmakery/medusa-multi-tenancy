import { model } from '@medusajs/framework/utils';

const ThemePublishStatus = model.define('theme_publish_status', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  theme_id: model.text(),
  status: model.enum(['published', 'unpublished']).default('unpublished'),
  published_at: model.dateTime().nullable(),
  unpublished_at: model.dateTime().nullable(),
});

export default ThemePublishStatus;
