import { Module } from '@medusajs/framework/utils';

import AppsModuleService from './service';

export const APPS_MODULE = 'appsModule';

export default Module(APPS_MODULE, {
  service: AppsModuleService,
});
