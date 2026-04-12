import { Module } from '@medusajs/framework/utils';

import AnalyticsModuleService from './service';

export const ANALYTICS_MODULE = 'analyticsModule';

export default Module(ANALYTICS_MODULE, {
  service: AnalyticsModuleService,
});
