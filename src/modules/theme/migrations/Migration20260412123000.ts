import { Migration } from '@mikro-orm/migrations';

export class Migration20260412123000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS theme_metadata (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(128) NOT NULL,
        version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
        author VARCHAR(255),
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, slug)
      );

      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS slug VARCHAR(128);
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS version VARCHAR(64) DEFAULT '1.0.0';
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS author VARCHAR(255);
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE theme_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_metadata_tenant_slug_unique ON theme_metadata(tenant_id, slug);
      CREATE INDEX IF NOT EXISTS idx_theme_metadata_tenant_active ON theme_metadata(tenant_id, is_active);

      CREATE TABLE IF NOT EXISTS theme_config (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        theme_id UUID NOT NULL,
        config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, theme_id)
      );

      ALTER TABLE theme_config ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE theme_config ADD COLUMN IF NOT EXISTS theme_id UUID;
      ALTER TABLE theme_config ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE theme_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE theme_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_config_tenant_theme_unique ON theme_config(tenant_id, theme_id);
      CREATE INDEX IF NOT EXISTS idx_theme_config_tenant ON theme_config(tenant_id);

      CREATE TABLE IF NOT EXISTS theme_publish_status (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        theme_id UUID NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'unpublished' CHECK (status IN ('published', 'unpublished')),
        published_at TIMESTAMPTZ,
        unpublished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, theme_id)
      );

      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS theme_id UUID;
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'unpublished';
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS unpublished_at TIMESTAMPTZ;
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE theme_publish_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_publish_status_tenant_theme_unique
        ON theme_publish_status(tenant_id, theme_id);
      CREATE INDEX IF NOT EXISTS idx_theme_publish_status_tenant_status
        ON theme_publish_status(tenant_id, status);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_theme_publish_status_tenant_status;
      DROP INDEX IF EXISTS idx_theme_publish_status_tenant_theme_unique;
      DROP INDEX IF EXISTS idx_theme_config_tenant;
      DROP INDEX IF EXISTS idx_theme_config_tenant_theme_unique;
      DROP INDEX IF EXISTS idx_theme_metadata_tenant_active;
      DROP INDEX IF EXISTS idx_theme_metadata_tenant_slug_unique;

      DROP TABLE IF EXISTS theme_publish_status CASCADE;
      DROP TABLE IF EXISTS theme_config CASCADE;
      DROP TABLE IF EXISTS theme_metadata CASCADE;
    `);
  }
}
