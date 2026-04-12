import { Module } from '@medusajs/framework/utils';

import AuditLogModuleService from './service';

export const AUDIT_LOG_MODULE = 'auditLogModule';

export default Module(AUDIT_LOG_MODULE, {
  service: AuditLogModuleService,
});
