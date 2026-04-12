-- Debug RLS Configuration
-- Run these queries in psql to debug Row Level Security issues

-- ============================================================================
-- 1. CHECK RLS STATUS
-- ============================================================================

-- Show all tables with RLS enabled
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  COUNT(p.polname) as policy_count
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relkind = 'r'
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND c.relrowsecurity = true
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;

-- ============================================================================
-- 2. CHECK POLICIES FOR A SPECIFIC TABLE
-- ============================================================================

-- Example: Check policies for 'product' table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,  -- 'PERMISSIVE' or 'RESTRICTIVE'
  roles,
  cmd,  -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'product'
ORDER BY cmd;

-- Or more detailed:
SELECT 
  polname as policy_name,
  CASE polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  CASE polpermissive
    WHEN true THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as type,
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check_expression
FROM pg_policy 
WHERE polrelid = 'product'::regclass;

-- ============================================================================
-- 3. CHECK tenant_id COLUMNS
-- ============================================================================

-- Find all tables with tenant_id column
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- Check indexes on tenant_id
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%tenant_id%'
  AND schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 4. TEST RLS FILTERING
-- ============================================================================

-- Check current session variable
SELECT current_setting('app.current_tenant', true) as current_tenant;

-- Set tenant context
SELECT set_config('app.current_tenant', 'your-tenant-id-here', false);

-- Verify it was set
SELECT current_setting('app.current_tenant', true) as current_tenant;

-- Query data (should be filtered by RLS)
SELECT id, tenant_id, title FROM product LIMIT 10;

-- Clear tenant context (admin mode)
SELECT set_config('app.current_tenant', '', false);

-- Query data (should see all tenants if you're superuser)
SELECT id, tenant_id, title FROM product LIMIT 10;

-- ============================================================================
-- 5. CHECK DATA DISTRIBUTION BY TENANT
-- ============================================================================

-- Count products per tenant
SELECT 
  tenant_id,
  COUNT(*) as product_count
FROM product
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id
ORDER BY product_count DESC;

-- Count orders per tenant
SELECT 
  tenant_id,
  COUNT(*) as order_count,
  SUM((SELECT SUM((li.unit_price * li.quantity)::numeric) FROM line_item li WHERE li.order_id = "order".id)) as total_revenue
FROM "order"
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id
ORDER BY order_count DESC;

-- Find tables with NULL tenant_id (needs migration?)
SELECT 
  'product' as table_name,
  COUNT(*) as null_tenant_count
FROM product
WHERE tenant_id IS NULL

UNION ALL

SELECT 
  'customer' as table_name,
  COUNT(*) as null_tenant_count
FROM customer
WHERE tenant_id IS NULL

UNION ALL

SELECT 
  'order' as table_name,
  COUNT(*) as null_tenant_count
FROM "order"
WHERE tenant_id IS NULL;

-- ============================================================================
-- 6. SIMULATE TENANT QUERIES
-- ============================================================================

-- Test as tenant A
DO $$
DECLARE
  tenant_a_id TEXT := 'test-tenant-a';
  result_count INTEGER;
BEGIN
  PERFORM set_config('app.current_tenant', tenant_a_id, false);
  
  SELECT COUNT(*) INTO result_count FROM product;
  
  RAISE NOTICE 'Tenant A sees % products', result_count;
END $$;

-- Test as tenant B
DO $$
DECLARE
  tenant_b_id TEXT := 'test-tenant-b';
  result_count INTEGER;
BEGIN
  PERFORM set_config('app.current_tenant', tenant_b_id, false);
  
  SELECT COUNT(*) INTO result_count FROM product;
  
  RAISE NOTICE 'Tenant B sees % products', result_count;
END $$;

-- Test as admin (no tenant)
DO $$
DECLARE
  result_count INTEGER;
BEGIN
  PERFORM set_config('app.current_tenant', NULL, false);
  
  SELECT COUNT(*) INTO result_count FROM product;
  
  RAISE NOTICE 'Admin sees % products', result_count;
END $$;

-- ============================================================================
-- 7. CHECK USER PRIVILEGES
-- ============================================================================

-- Check if current user is superuser (superusers bypass RLS)
SELECT 
  current_user,
  usesuper as is_superuser,
  CASE 
    WHEN usesuper THEN '⚠️  BYPASSES RLS'
    ELSE '✓ RLS APPLIES'
  END as rls_status
FROM pg_user
WHERE usename = current_user;

-- Check BYPASSRLS privilege
SELECT 
  rolname,
  rolsuper as superuser,
  rolbypassrls as bypass_rls
FROM pg_roles
WHERE rolname = current_user;

-- ============================================================================
-- 8. ENABLE/DISABLE RLS (ADMIN ONLY)
-- ============================================================================

-- Disable RLS on a table (for emergency access)
-- ALTER TABLE product DISABLE ROW LEVEL SECURITY;

-- Enable RLS on a table
-- ALTER TABLE product ENABLE ROW LEVEL SECURITY;

-- Force RLS (applies even to table owner - USE WITH CAUTION!)
-- ALTER TABLE product FORCE ROW LEVEL SECURITY;

-- Remove force (recommended for production)
-- ALTER TABLE product NO FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. CREATE RLS POLICY FOR NEW TABLE (TEMPLATE)
-- ============================================================================

/*
-- Template for adding RLS to a new table

-- 1. Add tenant_id column
ALTER TABLE your_table ADD COLUMN tenant_id UUID;
CREATE INDEX idx_your_table_tenant_id ON your_table (tenant_id);

-- 2. Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
CREATE POLICY your_table_tenant_isolation_select ON your_table
  FOR SELECT
  TO PUBLIC
  USING (
    tenant_id::text = (SELECT current_setting('app.current_tenant', true))
    OR (SELECT current_setting('app.current_tenant', true)) IS NULL
    OR (SELECT current_setting('app.current_tenant', true)) = ''
  );

CREATE POLICY your_table_tenant_isolation_insert ON your_table
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    tenant_id::text = (SELECT current_setting('app.current_tenant', true))
    OR (SELECT current_setting('app.current_tenant', true)) IS NULL
    OR (SELECT current_setting('app.current_tenant', true)) = ''
  );

CREATE POLICY your_table_tenant_isolation_update ON your_table
  FOR UPDATE
  TO PUBLIC
  USING (
    tenant_id::text = (SELECT current_setting('app.current_tenant', true))
    OR (SELECT current_setting('app.current_tenant', true)) IS NULL
    OR (SELECT current_setting('app.current_tenant', true)) = ''
  );

CREATE POLICY your_table_tenant_isolation_delete ON your_table
  FOR DELETE
  TO PUBLIC
  USING (
    tenant_id::text = (SELECT current_setting('app.current_tenant', true))
    OR (SELECT current_setting('app.current_tenant', true)) IS NULL
    OR (SELECT current_setting('app.current_tenant', true)) = ''
  );
*/

-- ============================================================================
-- 10. DROP RLS POLICY (CLEANUP)
-- ============================================================================

/*
-- Drop policies from a table
DROP POLICY IF EXISTS product_tenant_isolation_select ON product;
DROP POLICY IF EXISTS product_tenant_isolation_insert ON product;
DROP POLICY IF EXISTS product_tenant_isolation_update ON product;
DROP POLICY IF EXISTS product_tenant_isolation_delete ON product;

-- Disable RLS
ALTER TABLE product DISABLE ROW LEVEL SECURITY;

-- Drop tenant_id column (CAUTION: DELETES DATA!)
ALTER TABLE product DROP COLUMN tenant_id;
DROP INDEX IF EXISTS idx_product_tenant_id;
*/

