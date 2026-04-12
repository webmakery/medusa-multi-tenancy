import { MedusaService } from '@medusajs/framework/utils';

/**
 * Tenant Context Service
 *
 * This is a minimal service required for Medusa to detect the module
 * and execute its migrations. The actual RLS logic is in:
 * - middleware.ts (AsyncLocalStorage)
 * - patches/@medusajs+framework+2.10.1.patch (database hooks)
 */
class TenantContextModuleService extends MedusaService({}) {
  // No models needed - RLS is handled at database level
}

export default TenantContextModuleService;
