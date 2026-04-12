import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { APPS_MODULE } from '../modules/apps';
import AppsModuleService from '../modules/apps/service';

export default async function orderCreatedAppHook({ event, container }: SubscriberArgs<Record<string, unknown>>) {
  const appsService = container.resolve<AppsModuleService>(APPS_MODULE);

  await appsService.publishEventToSubscribers({
    event_name: 'order.created',
    data: event.data || {},
  });
}

export const config: SubscriberConfig = {
  event: 'order.created',
};
