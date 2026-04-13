import { Migration } from '@mikro-orm/migrations';

export class Migration20260413170000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS settings_json JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT false;

      UPDATE tenant
      SET settings_json = jsonb_build_object(
        'locale', 'en-US',
        'timezone', 'UTC',
        'currency_code', 'usd',
        'lifecycle', jsonb_build_object(
          'billing_mode', 'preserve_on_suspension',
          'retention_days', 90
        )
      )
      WHERE settings_json = '{}'::jsonb OR settings_json IS NULL;

      ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_status_check;
      ALTER TABLE tenant
      ADD CONSTRAINT tenant_status_check
      CHECK (status IN ('active', 'suspended', 'inactive', 'pending_deletion', 'deleted'));

      CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant(status);
      CREATE INDEX IF NOT EXISTS idx_tenant_scheduled_purge_at ON tenant(scheduled_purge_at);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_tenant_scheduled_purge_at;
      DROP INDEX IF EXISTS idx_tenant_status;

      ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_status_check;
      ALTER TABLE tenant
      ADD CONSTRAINT tenant_status_check
      CHECK (status IN ('active', 'inactive'));

      ALTER TABLE tenant DROP COLUMN IF EXISTS legal_hold;
      ALTER TABLE tenant DROP COLUMN IF EXISTS deleted_at;
      ALTER TABLE tenant DROP COLUMN IF EXISTS scheduled_purge_at;
      ALTER TABLE tenant DROP COLUMN IF EXISTS deletion_requested_at;
      ALTER TABLE tenant DROP COLUMN IF EXISTS deactivated_at;
      ALTER TABLE tenant DROP COLUMN IF EXISTS suspended_at;
      ALTER TABLE tenant DROP COLUMN IF EXISTS settings_json;
    `);
  }
}

