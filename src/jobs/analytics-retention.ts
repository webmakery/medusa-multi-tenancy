import { MedusaContainer } from '@medusajs/framework/types';

import { ANALYTICS_MODULE } from '../modules/analytics';
import AnalyticsModuleService from '../modules/analytics/service';

export default async function analyticsRetentionJob(container: MedusaContainer) {
  const analyticsService: AnalyticsModuleService = container.resolve(ANALYTICS_MODULE);
  await analyticsService.enforceRetentionPolicies();
}

export const config = {
  name: 'analytics-retention-job',
  schedule: '19 2 * * *',
};
