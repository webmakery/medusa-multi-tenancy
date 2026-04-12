import { defineMiddlewares } from '@medusajs/framework/http';

import { tenantContextMiddleware } from '../modules/tenant-context/middleware';
import { appWebhookSignatureVerificationMiddleware } from '../modules/apps/middleware';

export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/apps/webhooks/*',
      middlewares: [tenantContextMiddleware, appWebhookSignatureVerificationMiddleware],
    },
    {
      matcher: '*',
      middlewares: [tenantContextMiddleware],
    },
  ],
});

