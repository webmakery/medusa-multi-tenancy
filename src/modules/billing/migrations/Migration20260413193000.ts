import { Migration } from '@mikro-orm/migrations';

export class Migration20260413193000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS tenant_billing_account (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL UNIQUE,
        plan_code VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'trialing',
        trial_starts_at TIMESTAMPTZ,
        trial_ends_at TIMESTAMPTZ,
        current_period_start TIMESTAMPTZ NOT NULL,
        current_period_end TIMESTAMPTZ NOT NULL,
        grace_ends_at TIMESTAMPTZ,
        last_payment_failed_at TIMESTAMPTZ,
        failed_payment_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_billing_entitlement (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        feature_key VARCHAR(128) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        limit_value INTEGER,
        meter_key VARCHAR(128),
        period VARCHAR(32) NOT NULL DEFAULT 'monthly',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, feature_key)
      );

      CREATE TABLE IF NOT EXISTS tenant_billing_meter_event (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        meter_key VARCHAR(128) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        metadata_json JSONB,
        occurred_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_billing_usage (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        meter_key VARCHAR(128) NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        used_quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, meter_key, period_start, period_end)
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_billing_account_tenant_id ON tenant_billing_account(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_billing_entitlement_tenant_id ON tenant_billing_entitlement(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_billing_meter_event_tenant_meter ON tenant_billing_meter_event(tenant_id, meter_key);
      CREATE INDEX IF NOT EXISTS idx_tenant_billing_usage_tenant_meter ON tenant_billing_usage(tenant_id, meter_key);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_tenant_billing_usage_tenant_meter;
      DROP INDEX IF EXISTS idx_tenant_billing_meter_event_tenant_meter;
      DROP INDEX IF EXISTS idx_tenant_billing_entitlement_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_billing_account_tenant_id;

      DROP TABLE IF EXISTS tenant_billing_usage CASCADE;
      DROP TABLE IF EXISTS tenant_billing_meter_event CASCADE;
      DROP TABLE IF EXISTS tenant_billing_entitlement CASCADE;
      DROP TABLE IF EXISTS tenant_billing_account CASCADE;
    `);
  }
}
