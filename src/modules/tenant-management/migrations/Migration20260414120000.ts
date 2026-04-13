import { Migration } from '@mikro-orm/migrations';

export class Migration20260414120000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS tenant_user_access (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255),
        user_email VARCHAR(255) NOT NULL UNIQUE,
        tenant_id UUID,
        role VARCHAR(32) NOT NULL DEFAULT 'tenant_admin',
        is_platform_admin BOOLEAN NOT NULL DEFAULT false,
        active_tenant_id UUID,
        is_auto_provisioned BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tenant_user_access_role_check CHECK (role IN ('platform_admin', 'tenant_admin')),
        CONSTRAINT tenant_user_access_scope_check CHECK (
          (is_platform_admin = true AND tenant_id IS NULL)
          OR (is_platform_admin = false AND tenant_id IS NOT NULL)
        )
      );

      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'tenant_admin';
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS active_tenant_id UUID;
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS is_auto_provisioned BOOLEAN DEFAULT false;
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE tenant_user_access ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE tenant_user_access DROP CONSTRAINT IF EXISTS tenant_user_access_role_check;
      ALTER TABLE tenant_user_access
      ADD CONSTRAINT tenant_user_access_role_check CHECK (role IN ('platform_admin', 'tenant_admin'));

      ALTER TABLE tenant_user_access DROP CONSTRAINT IF EXISTS tenant_user_access_scope_check;
      ALTER TABLE tenant_user_access
      ADD CONSTRAINT tenant_user_access_scope_check CHECK (
        (is_platform_admin = true AND tenant_id IS NULL)
        OR (is_platform_admin = false AND tenant_id IS NOT NULL)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_user_access_user_email_unique
        ON tenant_user_access(user_email);
      CREATE INDEX IF NOT EXISTS idx_tenant_user_access_tenant_id ON tenant_user_access(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_user_access_active_tenant_id ON tenant_user_access(active_tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_user_access_is_platform_admin ON tenant_user_access(is_platform_admin);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_tenant_user_access_is_platform_admin;
      DROP INDEX IF EXISTS idx_tenant_user_access_active_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_user_access_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_user_access_user_email_unique;
      DROP TABLE IF EXISTS tenant_user_access CASCADE;
    `);
  }
}
