import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { APPS_MODULE } from '../modules/apps';
import AppsModuleService from '../modules/apps/service';

export default async function customerCreatedAppHook({ event, container }: SubscriberArgs<Record<string, unknown>>) {
  const appsService = container.resolve<AppsModuleService>(APPS_MODULE);

  await appsService.publishEventToSubscribers({
    event_name: 'customer.created',
    data: event.data || {},
  });
}

export const config: SubscriberConfig = {
  event: 'customer.created',
};
