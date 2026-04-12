import { Module } from '@medusajs/framework/utils';

import TenantManagementModuleService from './service';

export const TENANT_MANAGEMENT_MODULE = 'tenantManagementModule';

export default Module(TENANT_MANAGEMENT_MODULE, {
  service: TenantManagementModuleService,
});
