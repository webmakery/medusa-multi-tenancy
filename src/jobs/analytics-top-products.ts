import { MedusaContainer } from '@medusajs/framework/types';

import { ANALYTICS_MODULE } from '../modules/analytics';
import AnalyticsModuleService from '../modules/analytics/service';

export default async function analyticsTopProductsJob(container: MedusaContainer) {
  const analyticsService: AnalyticsModuleService = container.resolve(ANALYTICS_MODULE);
  await analyticsService.aggregatePendingEvents();
}

export const config = {
  name: 'analytics-top-products-job',
  schedule: '7 */1 * * *',
};
