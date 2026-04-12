import { defineMiddlewares } from '@medusajs/framework/http';

import { tenantContextMiddleware } from '../modules/tenant-context/middleware';

export default defineMiddlewares({
  routes: [
    {
      matcher: '*',
      middlewares: [tenantContextMiddleware]
    }
  ]
});

