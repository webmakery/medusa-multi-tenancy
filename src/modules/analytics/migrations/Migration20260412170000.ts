import { Migration } from '@mikro-orm/migrations';

export class Migration20260412170000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS analytics_event (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_date DATE NOT NULL,
        session_id VARCHAR(255),
        order_id VARCHAR(255),
        currency_code VARCHAR(16),
        amount_cents BIGINT,
        items JSONB,
        metadata JSONB,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analytics_rollup_daily (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        rollup_date DATE NOT NULL,
        currency_code VARCHAR(16),
        sessions_count INTEGER NOT NULL DEFAULT 0,
        checkout_started_count INTEGER NOT NULL DEFAULT 0,
        checkout_completed_count INTEGER NOT NULL DEFAULT 0,
        orders_count INTEGER NOT NULL DEFAULT 0,
        gmv_cents BIGINT NOT NULL DEFAULT 0,
        aov_cents INTEGER NOT NULL DEFAULT 0,
        conversion_proxy NUMERIC(10, 6) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, rollup_date)
      );

      CREATE TABLE IF NOT EXISTS analytics_top_product_daily (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        rollup_date DATE NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_title TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        gmv_cents BIGINT NOT NULL DEFAULT 0,
        rank INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, rollup_date, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_event_pending ON analytics_event(tenant_id, event_date, processed_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_event(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_rollup_tenant_date ON analytics_rollup_daily(tenant_id, rollup_date);
      CREATE INDEX IF NOT EXISTS idx_analytics_top_products_tenant_date ON analytics_top_product_daily(tenant_id, rollup_date);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_analytics_top_products_tenant_date;
      DROP INDEX IF EXISTS idx_analytics_rollup_tenant_date;
      DROP INDEX IF EXISTS idx_analytics_event_type;
      DROP INDEX IF EXISTS idx_analytics_event_pending;

      DROP TABLE IF EXISTS analytics_top_product_daily CASCADE;
      DROP TABLE IF EXISTS analytics_rollup_daily CASCADE;
      DROP TABLE IF EXISTS analytics_event CASCADE;
    `);
  }
}
