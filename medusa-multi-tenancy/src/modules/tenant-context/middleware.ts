import { AsyncLocalStorage } from 'async_hooks';

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';

/**
 * Type for tenant context stored in AsyncLocalStorage
 */
export interface TenantContext {
  tenantId: string;
}

/**
 * AsyncLocalStorage to maintain tenant context across async operations
 * This ensures tenant_id is available to database connection hooks
 *
 * CRITICAL: This is used by the Medusa framework patch (patches/@medusajs+framework+2.10.1.patch)
 * to inject tenant context into all database queries for Row Level Security (RLS).
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Middleware to extract tenant_id from request and store in AsyncLocalStorage context
 *
 * Tenant ID can come from:
 * - Header: x-tenant-id (recommended for production)
 * - JWT token: tenant_id claim (if you store it in JWT)
 * - Query parameter: tenant_id (for testing/development only)
 *
 * The tenant_id is stored in AsyncLocalStorage, which makes it available
 * to the database connection hooks (via patch) that set PostgreSQL session variables.
 */
export function tenantContextMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Extract tenant_id from various sources
  let tenantId: string | undefined;

  // 1. Check header (recommended for production)
  tenantId = req.headers['x-tenant-id'] as string;

  // 2. Check JWT token if authenticated
  // Note: req.auth is not available in MedusaRequest type
  // If you need JWT-based tenant extraction, use a custom property or header
  // Example implementation (commented out):
  // if (!tenantId && (req as any).auth?.context) {
  //   const actorMetadata = (req as any).auth.context?.actor_metadata;
  //   if (actorMetadata?.tenant_id) {
  //     tenantId = actorMetadata.tenant_id;
  //   }
  // }

  // 3. Check query parameter (for testing/development only)
  if (!tenantId && process.env.NODE_ENV !== 'production') {
    tenantId = req.query.tenant_id as string;
  }

  // If tenant_id is found, validate and store it in AsyncLocalStorage
  if (tenantId) {
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      console.log(`[TENANT_MIDDLEWARE] Invalid tenant_id format: ${tenantId}`);
      return res.status(400).json({
        message: 'Invalid tenant_id format. Expected UUID.'
      });
    }

    console.log(`[TENANT_MIDDLEWARE] Setting tenant context: ${tenantId}`);
    // Store tenant context in AsyncLocalStorage
    // This will be available to all async operations in this request
    return tenantContextStorage.run({ tenantId }, () => {
      next();
    });
  }

  // No tenant_id found - continue without context (admin/system mode)
  // RLS policies allow queries when app.current_tenant is NULL
  console.log('[TENANT_MIDDLEWARE] No tenant_id - admin mode');
  next();
}
