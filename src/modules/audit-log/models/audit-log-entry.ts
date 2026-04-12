import { model } from '@medusajs/framework/utils';

const AuditLogEntry = model.define('audit_log', {
  id: model.id().primaryKey(),
  actor: model.text(),
  tenant_id: model.text(),
  action: model.text(),
  resource_id: model.text(),
  payload_hash: model.text(),
  event_timestamp: model.dateTime(),
});

export default AuditLogEntry;
