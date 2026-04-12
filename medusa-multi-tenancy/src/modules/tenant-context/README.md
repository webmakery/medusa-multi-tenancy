# Tenant Context Module

Multi-tenancy support for Nazare API using PostgreSQL Row Level Security (RLS).

## 🚀 Quick Start

```bash
# 1. Install dependencies (patch-package will auto-apply)
yarn install

# 2. Run RLS migration
yarn medusa db:migrate

# 3. Check RLS status
./check-rls.sh

# 4. Run tests
yarn test:integration:api --testPathPattern=rls-patch

# 5. Start server
yarn dev
```

## 📖 Documentation

- **[RLS_SETUP.md](./RLS_SETUP.md)** - Complete setup guide with examples
- **[README.md](./README.md)** - This file (architecture overview)
- **[Integration Tests](../../integration-tests/api/tenant-context/rls-patch.spec.ts)** - Test examples

## Overview

This module provides tenant isolation at the database level using PostgreSQL RLS policies. All database queries are automatically filtered by `tenant_id`, ensuring complete data isolation between tenants.

## Architecture

```
┌─────────────┐
│   Request   │ x-tenant-id: uuid
└──────┬──────┘
       │
       ▼
┌────────────────────┐
│    Middleware      │ tenantContextMiddleware
│ (middleware.ts)    │ Extracts tenant_id from header
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ AsyncLocalStorage  │ tenantContextStorage
│                    │ Stores tenant_id for async operations
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Framework Patch   │ patches/@medusajs+framework+2.10.1.patch
│  (Knex hooks)      │ Reads tenant_id from AsyncLocalStorage
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│    PostgreSQL      │ SET app.current_tenant = 'uuid'
│   (set_config)     │ Session variable for RLS
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   RLS Policies     │ WHERE tenant_id = current_setting('app.current_tenant')
│  (migrations)      │ Filter data by tenant
└────────────────────┘
```

## Components

### 1. Middleware (`middleware.ts`)

**Purpose**: Extract tenant_id from request and store in AsyncLocalStorage

**Exports**:

- `tenantContextStorage` - AsyncLocalStorage instance (used by framework patch)
- `tenantContextMiddleware` - Express middleware function

**Tenant ID Sources** (in order of priority):

1. Header: `x-tenant-id` (recommended for production)
2. JWT token: `tenant_id` claim (if stored in auth)
3. Query parameter: `tenant_id` (development only)

**Example**:

```typescript
// Registered globally in src/api/middlewares.ts
{
  matcher: '*',
  middlewares: [tenantContextMiddleware]
}
```

### 2. Framework Patch (`patches/@medusajs+framework+2.10.1.patch`)

**Purpose**: Hook into ALL database connections to inject tenant context

**How it works**:

1. Wraps `client.acquireConnection` - Sets tenant context when connection acquired
2. Wraps `client.query` - Ensures tenant context before each query
3. Wraps `transaction` - Maintains tenant context throughout transaction

**Code**:

```javascript
// Reads from AsyncLocalStorage
function getTenantIdFromContext() {
  const tenantContextModule = require('src/modules/tenant-context/middleware');
  return tenantContextModule?.tenantContextStorage?.getStore()?.tenantId || null;
}

// Sets PostgreSQL session variable
await connection.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
```

### 3. RLS Policies (`migrations/`)

**Purpose**: Create PostgreSQL RLS policies to filter data by tenant

**Example Migration**:

```typescript
// Migration20251127165657.ts
await this.knex.raw(`
  -- Enable RLS on table
  ALTER TABLE customer_details ENABLE ROW LEVEL SECURITY;
  
  -- Create policy for SELECT
  CREATE POLICY customer_details_tenant_isolation_select ON customer_details
    FOR SELECT
    USING (
      tenant_id = current_setting('app.current_tenant', true)::UUID
      OR current_setting('app.current_tenant', true) IS NULL
    );
  
  -- Create policy for INSERT
  CREATE POLICY customer_details_tenant_isolation_insert ON customer_details
    FOR INSERT
    WITH CHECK (
      tenant_id = current_setting('app.current_tenant', true)::UUID
      OR current_setting('app.current_tenant', true) IS NULL
    );
`);
```

**Policy Logic**:

- `tenant_id = current_setting('app.current_tenant')` - Match tenant
- `OR ... IS NULL` - Allow admin mode (no tenant filter)

## Usage

### Enable RLS on a table

1. **Add `tenant_id` column**:

```sql
ALTER TABLE your_table ADD COLUMN tenant_id UUID;
CREATE INDEX idx_your_table_tenant_id ON your_table (tenant_id);
```

2. **Enable RLS**:

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE your_table FORCE ROW LEVEL SECURITY;
```

3. **Create policies**:

```sql
-- SELECT policy
CREATE POLICY your_table_tenant_isolation_select ON your_table
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant', true)::UUID
    OR current_setting('app.current_tenant', true) IS NULL
  );

-- INSERT policy
CREATE POLICY your_table_tenant_isolation_insert ON your_table
  FOR INSERT
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::UUID
    OR current_setting('app.current_tenant', true) IS NULL
  );

-- UPDATE policy
CREATE POLICY your_table_tenant_isolation_update ON your_table
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant', true)::UUID
    OR current_setting('app.current_tenant', true) IS NULL
  );

-- DELETE policy
CREATE POLICY your_table_tenant_isolation_delete ON your_table
  FOR DELETE
  USING (
    tenant_id = current_setting('app.current_tenant', true)::UUID
    OR current_setting('app.current_tenant', true) IS NULL
  );
```

### Make API requests with tenant context

```bash
# Tenant-specific request
curl -H "x-tenant-id: 123e4567-e89b-12d3-a456-426614174000" \
  http://localhost:9000/store/products

# Admin request (no tenant filter)
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:9000/admin/products
```

### Check current tenant in SQL

```sql
-- Get current tenant
SELECT current_setting('app.current_tenant', true) as tenant_id;

-- Test RLS manually
SET app.current_tenant = '123e4567-e89b-12d3-a456-426614174000';
SELECT * FROM customer_details;
-- Only returns data for tenant 123e4567...

-- Admin mode
SET app.current_tenant = NULL;
SELECT * FROM customer_details;
-- Returns all data
```

## Testing

### Integration Tests

```bash
yarn test:integration:api --testPathPattern="rls.spec"
```

Tests verify:

- ✅ Tenant isolation (each tenant sees only their data)
- ✅ Admin mode (no tenant = see all data)
- ✅ Cross-tenant access prevention
- ✅ Session variable management
- ✅ Transaction consistency

### Manual Testing

1. **Start server**:

```bash
yarn dev
```

2. **Check logs for RLS initialization**:

```
[RLS_PATCH] Initializing Row Level Security hooks on Knex connection
[RLS_PATCH] Hooked into client.acquireConnection
[RLS_PATCH] Hooked into client.query
[RLS_PATCH] Hooked into transaction
[RLS_PATCH] Row Level Security hooks initialized successfully
```

3. **Test tenant isolation**:

```bash
# Create data for tenant 1
curl -X POST -H "x-tenant-id: tenant-1-uuid" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant 1 Product"}' \
  http://localhost:9000/store/products

# Create data for tenant 2
curl -X POST -H "x-tenant-id: tenant-2-uuid" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant 2 Product"}' \
  http://localhost:9000/store/products

# Verify tenant 1 only sees their data
curl -H "x-tenant-id: tenant-1-uuid" \
  http://localhost:9000/store/products
# Should only return "Tenant 1 Product"

# Verify tenant 2 only sees their data
curl -H "x-tenant-id: tenant-2-uuid" \
  http://localhost:9000/store/products
# Should only return "Tenant 2 Product"

# Verify admin sees all data
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:9000/admin/products
# Should return both products
```

## Security Considerations

### ✅ Secure

- **RLS at database level** - Cannot be bypassed by application code
- **Automatic injection** - Framework patch ensures all queries are filtered
- **UUID validation** - Middleware validates tenant_id format
- **Admin mode** - Explicit NULL check in RLS policies

### ⚠️ Important

1. **Always use `x-tenant-id` header in production** (not query params)
2. **Validate tenant_id ownership** - Ensure user belongs to tenant before setting header
3. **Use HTTPS** - Prevent header interception
4. **Audit admin access** - Log all NULL tenant queries (admin mode)
5. **Test RLS policies** - Verify data isolation for each tenant-isolated table

### 🛡️ Defense in Depth

Even with RLS:

- Validate tenant ownership at application layer
- Log tenant context changes
- Monitor cross-tenant access attempts
- Use separate admin authentication

## Troubleshooting

### Problem: RLS not working

**Symptoms**:

- Queries return data from all tenants
- No `[RLS_PATCH]` logs during startup

**Solutions**:

1. Check patch was applied:

   ```bash
   grep -n "RLS_PATCH" node_modules/@medusajs/framework/dist/database/pg-connection-loader.js
   ```

2. Check middleware exports:

   ```bash
   grep "export const tenantContextStorage" src/modules/tenant-context/middleware.ts
   ```

3. Check RLS policies exist:

   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```

4. Enable debug logging:
   ```bash
   LOG_LEVEL=debug yarn dev
   ```

### Problem: Tenant context not set

**Symptoms**:

- `[RLS_PATCH] Set app.current_tenant: null` in logs
- Queries return empty results

**Causes**:

1. Missing `x-tenant-id` header
2. Invalid tenant_id format (must be UUID)
3. Middleware not registered

**Debug**:

```typescript
// Add logging to middleware
export function tenantContextMiddleware(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  console.log('[TENANT_MIDDLEWARE] Received tenant_id:', tenantId);
  // ...
}
```

### Problem: Performance issues

**Symptoms**:

- Slow queries
- Many `set_config` calls in logs

**Solutions**:

1. Check WeakMap optimization:

   ```
   [RLS_PATCH] Set app.current_tenant: <uuid> for connection
   [RLS_PATCH] Set app.current_tenant: <uuid> for connection (duplicate = bad)
   ```

2. Check connection pooling:

   ```typescript
   // medusa-config.ts
   databaseDriverOptions: {
     pool: {
       min: 2,
       max: 10
     }
   }
   ```

3. Add database indexes:
   ```sql
   CREATE INDEX idx_your_table_tenant_id ON your_table (tenant_id);
   ```

## Migration Guide

### From Old Loader to Framework Patch

If you had the old `loaders/database-connection.ts`, follow these steps:

1. **✅ Patch already applied** - You're using the new approach
2. **Remove old loader** - Already done
3. **Keep middleware** - Required by patch
4. **Keep migrations** - RLS policies still needed
5. **Test** - Run integration tests

```bash
yarn test:integration:api --testPathPattern="rls.spec"
```

## Further Reading

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [Medusa Middleware Guide](https://docs.medusajs.com/development/api-routes/middlewares)
- `patches/README.md` - Framework patch documentation
- `docs/SUMMARY_MULTI_TENANCY_PL.md` - Multi-tenancy implementation guide
