import { Migration } from '@mikro-orm/migrations';

export class Migration20260412150000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS app_installation (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        app_name VARCHAR(255) NOT NULL,
        app_identifier VARCHAR(128) NOT NULL,
        app_url TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'uninstalled')),
        installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uninstalled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, app_identifier)
      );

      CREATE TABLE IF NOT EXISTS app_scope (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        app_id UUID NOT NULL,
        scope VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (app_id, scope)
      );

      CREATE TABLE IF NOT EXISTS app_webhook (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        app_id UUID NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        target_url TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (app_id, event_name, target_url)
      );

      CREATE TABLE IF NOT EXISTS app_credential (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        app_id UUID NOT NULL,
        key_id VARCHAR(255) NOT NULL,
        secret TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        rotated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_app_installation_tenant ON app_installation(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_app_installation_status ON app_installation(status);
      CREATE INDEX IF NOT EXISTS idx_app_scope_app_id ON app_scope(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_webhook_event_name ON app_webhook(event_name);
      CREATE INDEX IF NOT EXISTS idx_app_webhook_app_id ON app_webhook(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_credential_app_id_active ON app_credential(app_id, is_active);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_app_credential_app_id_active;
      DROP INDEX IF EXISTS idx_app_webhook_app_id;
      DROP INDEX IF EXISTS idx_app_webhook_event_name;
      DROP INDEX IF EXISTS idx_app_scope_app_id;
      DROP INDEX IF EXISTS idx_app_installation_status;
      DROP INDEX IF EXISTS idx_app_installation_tenant;

      DROP TABLE IF EXISTS app_credential CASCADE;
      DROP TABLE IF EXISTS app_webhook CASCADE;
      DROP TABLE IF EXISTS app_scope CASCADE;
      DROP TABLE IF EXISTS app_installation CASCADE;
    `);
  }
}
