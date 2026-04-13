import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { APPS_MODULE } from '../modules/apps';
import AppsModuleService from '../modules/apps/service';
import { requireTenantJobContext } from '../modules/tenant-context/job-context';

export default async function customerCreatedAppHook({ event, container }: SubscriberArgs<Record<string, unknown>>) {
  const appsService = container.resolve<AppsModuleService>(APPS_MODULE);
  const tenantContext = requireTenantJobContext(event.data, 'customer-created-app-hook');

  await appsService.publishEventToSubscribers({
    tenant_id: tenantContext.tenant_id,
    event_name: 'customer.created',
    data: event.data || {},
  });
}

export const config: SubscriberConfig = {
  event: 'customer.created',
};
