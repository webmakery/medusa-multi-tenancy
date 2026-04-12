import { Migration } from '@mikro-orm/migrations';

/**
 * Add tenant_id column and RLS policies to all Medusa core tables
 *
 * This migration:
 * 1. Adds tenant_id UUID column to all main tables
 * 2. Creates indexes on tenant_id for performance
 * 3. Enables Row Level Security (RLS) on all tables
 * 4. Creates RLS policies for SELECT, INSERT, UPDATE, DELETE operations
 *
 * Tables covered:
 * - Core: product, customer, order, cart, user, invite
 * - Sales: sales_channel, payment_collection, payment, fulfillment, shipping_method
 * - Inventory: inventory_item, reservation
 * - Content: region, store, currency, price_list
 * - Auth: api_key
 * - Promotions: promotion, campaign
 */
export class Migration20251201120000 extends Migration {
  async up(): Promise<void> {
    // List of all core Medusa tables that need tenant isolation
    const tables = [
      // Core entities
      'product',
      'product_variant',
      'product_option',
      'product_option_value',
      'product_type',
      'product_collection',
      'product_category',
      'product_tag',
      'image',

      // Customer & Auth
      'customer',
      'customer_group',
      'customer_address',
      'user',
      'invite',

      // Orders & Cart
      'order',
      'order_item',
      'cart',
      'line_item',
      'order_change',
      'order_claim',
      'order_edit',
      'return',
      'return_item',
      'return_reason',

      // Payments
      'payment_collection',
      'payment',
      'refund',

      // Fulfillment & Shipping
      'fulfillment',
      'fulfillment_item',
      'fulfillment_set',
      'shipping_option',
      'shipping_profile',
      'shipping_method',

      // Inventory
      'inventory_item',
      'inventory_level',
      'reservation_item',
      'stock_location',

      // Sales Channels
      'sales_channel',

      // Regions & Store
      'region',
      'store',
      'currency',

      // Pricing
      'price_list',
      'price_set',
      'price',
      'money_amount',

      // Promotions
      'promotion',
      'campaign',
      'discount',

      // API & Auth
      'api_key',
      'publishable_api_key',

      // Notifications
      'notification',

      // Workflows
      'workflow_execution'
    ];

    // Step 1: Add tenant_id column to all tables
    console.log('Adding tenant_id column to all tables...');
    for (const table of tables) {
      try {
        await this.execute(`
          -- Add tenant_id column if table exists and column doesn't exist
          DO $$ 
          BEGIN
            -- Check if table exists
            IF EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = '${table}'
            ) THEN
              -- Check if column doesn't exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'tenant_id'
              ) THEN
                -- Add column with DEFAULT that pulls from session variable
                ALTER TABLE "${table}" ADD COLUMN tenant_id UUID 
                  DEFAULT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
                CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON "${table}" (tenant_id);
                RAISE NOTICE 'Added tenant_id to table: ${table}';
              ELSE
                -- If column exists, add DEFAULT if it doesn't have one
                ALTER TABLE "${table}" ALTER COLUMN tenant_id 
                  SET DEFAULT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
                RAISE NOTICE 'Updated tenant_id DEFAULT for table: ${table}';
              END IF;
            END IF;
          END $$;
        `);
      } catch (error) {
        // Skip any errors (table might not exist, etc.)
        console.log(`Skipped table ${table}: ${error}`);
      }
    }

    // Step 2: Enable RLS on all tables
    console.log('Enabling RLS on all tables...');
    for (const table of tables) {
      try {
        await this.execute(`
          DO $$
          BEGIN
            -- Enable RLS
            EXECUTE 'ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY';
            
            -- IMPORTANT: Do NOT use FORCE ROW LEVEL SECURITY in production!
            -- FORCE makes RLS apply to table owner (usually 'postgres')
            -- This breaks migrations and admin operations
            -- Only non-superuser roles will have RLS enforced
            
            RAISE NOTICE 'Enabled RLS on table: ${table}';
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Skipped RLS for ${table}: %', SQLERRM;
          END $$;
        `);
      } catch (error) {
        console.log(`Skipped RLS for ${table}: ${error}`);
      }
    }

    // Step 3: Create RLS policies for all tables
    console.log('Creating RLS policies...');
    for (const table of tables) {
      try {
        await this.execute(`
          DO $$
          BEGIN
            -- DROP existing policies if they exist
            DROP POLICY IF EXISTS ${table}_tenant_isolation_select ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_insert ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_update ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_delete ON "${table}";
            
            -- SELECT policy: Show only rows matching current tenant or all rows if no tenant (admin mode)
            CREATE POLICY ${table}_tenant_isolation_select ON "${table}"
              FOR SELECT
              TO PUBLIC
              USING (
                -- Allow if tenant_id matches current tenant
                tenant_id::text = (SELECT current_setting('app.current_tenant', true))
                -- OR allow if no tenant is set (admin/system mode)
                OR (SELECT current_setting('app.current_tenant', true)) IS NULL
                OR (SELECT current_setting('app.current_tenant', true)) = ''
              );
            
            -- INSERT policy: Only allow inserts with matching tenant_id
            CREATE POLICY ${table}_tenant_isolation_insert ON "${table}"
              FOR INSERT
              TO PUBLIC
              WITH CHECK (
                tenant_id::text = (SELECT current_setting('app.current_tenant', true))
                OR (SELECT current_setting('app.current_tenant', true)) IS NULL
                OR (SELECT current_setting('app.current_tenant', true)) = ''
              );
            
            -- UPDATE policy: Only update rows matching current tenant
            CREATE POLICY ${table}_tenant_isolation_update ON "${table}"
              FOR UPDATE
              TO PUBLIC
              USING (
                tenant_id::text = (SELECT current_setting('app.current_tenant', true))
                OR (SELECT current_setting('app.current_tenant', true)) IS NULL
                OR (SELECT current_setting('app.current_tenant', true)) = ''
              )
              WITH CHECK (
                tenant_id::text = (SELECT current_setting('app.current_tenant', true))
                OR (SELECT current_setting('app.current_tenant', true)) IS NULL
                OR (SELECT current_setting('app.current_tenant', true)) = ''
              );
            
            -- DELETE policy: Only delete rows matching current tenant
            CREATE POLICY ${table}_tenant_isolation_delete ON "${table}"
              FOR DELETE
              TO PUBLIC
              USING (
                tenant_id::text = (SELECT current_setting('app.current_tenant', true))
                OR (SELECT current_setting('app.current_tenant', true)) IS NULL
                OR (SELECT current_setting('app.current_tenant', true)) = ''
              );
            
            RAISE NOTICE 'Created RLS policies for table: ${table}';
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Skipped policies for ${table}: %', SQLERRM;
          END $$;
        `);
      } catch (error) {
        console.log(`Skipped policies for ${table}: ${error}`);
      }
    }

    // Step 4: Create helper function to check RLS status
    await this.execute(`
      -- Helper function to check RLS status
      CREATE OR REPLACE FUNCTION check_rls_status()
      RETURNS TABLE (
        table_name TEXT,
        rls_enabled BOOLEAN,
        rls_forced BOOLEAN,
        policy_count INTEGER
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          c.relname::TEXT,
          c.relrowsecurity,
          c.relforcerowsecurity,
          COUNT(p.polname)::INTEGER
        FROM pg_class c
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE c.relkind = 'r'
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND c.relrowsecurity = true
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname;
      END;
      $$ LANGUAGE plpgsql;
      
      COMMENT ON FUNCTION check_rls_status() IS 'Returns RLS status for all tables with RLS enabled';
    `);

    console.log('✓ RLS migration completed!');
    console.log('');
    console.log('To check RLS status, run:');
    console.log('  SELECT * FROM check_rls_status();');
  }

  async down(): Promise<void> {
    // List of tables (same as up())
    const tables = [
      'product',
      'product_variant',
      'product_option',
      'product_option_value',
      'product_type',
      'product_collection',
      'product_category',
      'product_tag',
      'image',
      'customer',
      'customer_group',
      'customer_address',
      'user',
      'invite',
      'order',
      'order_item',
      'cart',
      'line_item',
      'order_change',
      'order_claim',
      'order_edit',
      'return',
      'return_item',
      'return_reason',
      'payment_collection',
      'payment',
      'refund',
      'fulfillment',
      'fulfillment_item',
      'fulfillment_set',
      'shipping_option',
      'shipping_profile',
      'shipping_method',
      'inventory_item',
      'inventory_level',
      'reservation_item',
      'stock_location',
      'sales_channel',
      'region',
      'store',
      'currency',
      'price_list',
      'price_set',
      'price',
      'money_amount',
      'promotion',
      'campaign',
      'discount',
      'api_key',
      'publishable_api_key',
      'notification',
      'workflow_execution'
    ];

    console.log('Rolling back RLS migration...');

    // Drop RLS policies
    for (const table of tables) {
      try {
        await this.execute(`
          DO $$
          BEGIN
            DROP POLICY IF EXISTS ${table}_tenant_isolation_select ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_insert ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_update ON "${table}";
            DROP POLICY IF EXISTS ${table}_tenant_isolation_delete ON "${table}";
            
            -- Disable RLS
            EXECUTE 'ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY';
            
            RAISE NOTICE 'Removed RLS from table: ${table}';
          EXCEPTION
            WHEN OTHERS THEN
              NULL;
          END $$;
        `);
      } catch (error) {
        // Continue even if table doesn't exist
      }
    }

    // Drop tenant_id columns (CAREFUL: This will delete data!)
    console.log('WARNING: Removing tenant_id columns (data will be lost)');
    for (const table of tables) {
      try {
        await this.execute(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = '${table}' AND column_name = 'tenant_id'
            ) THEN
              ALTER TABLE "${table}" DROP COLUMN tenant_id;
              DROP INDEX IF EXISTS idx_${table}_tenant_id;
            END IF;
          END $$;
        `);
      } catch (error) {
        // Continue
      }
    }

    // Drop helper function
    await this.execute('DROP FUNCTION IF EXISTS check_rls_status()');

    console.log('✓ RLS rollback completed');
  }
}
