import { Module } from '@medusajs/framework/utils';

/**
 * Tenant Context Module
 *
 * Provides multi-tenancy support via Row Level Security (RLS) for PostgreSQL.
 *
 * Key components:
 * - middleware.ts: Exports tenantContextStorage (AsyncLocalStorage) used by the framework patch
 * - patches/@medusajs+framework+2.10.1.patch: Hooks into all database queries to inject tenant context
 * - migrations: Creates RLS policies on tenant-isolated tables
 *
 * How it works:
 * 1. Middleware extracts tenant_id from request (header: x-tenant-id)
 * 2. Stores tenant_id in AsyncLocalStorage (tenantContextStorage)
 * 3. Framework patch reads from tenantContextStorage before each query
 * 4. Sets PostgreSQL session variable: app.current_tenant = tenant_id
 * 5. RLS policies filter data based on app.current_tenant
 *
 * Migration from old approach:
 * - Old: Custom loader in loaders/database-connection.ts (deprecated)
 * - New: Framework patch (patches/@medusajs+framework+2.10.1.patch)
 *
 * The patch approach is superior because:
 * - ✅ Applies to ALL database connections (cannot be bypassed)
 * - ✅ Runs at connection initialization time
 * - ✅ Works with all Medusa modules without modification
 */
import TenantContextModuleService from './service';

export const TENANT_CONTEXT_MODULE = 'tenantContextModule';

export default Module(TENANT_CONTEXT_MODULE, {
  service: TenantContextModuleService
  // No loaders needed - RLS hooks are applied via framework patch
  // See: patches/@medusajs+framework+2.10.1.patch
});
