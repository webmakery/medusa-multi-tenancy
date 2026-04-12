import { Migration } from '@mikro-orm/migrations';

export class Migration20260412193000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS app_webhook_delivery_log (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        app_id UUID NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        target_url TEXT NOT NULL,
        delivery_status VARCHAR(32) NOT NULL CHECK (delivery_status IN ('delivered', 'failed')),
        attempt_number INTEGER NOT NULL,
        response_status INTEGER,
        error_message TEXT,
        delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_app_webhook_delivery_log_app_time ON app_webhook_delivery_log(app_id, delivered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_webhook_delivery_log_tenant_time ON app_webhook_delivery_log(tenant_id, delivered_at DESC);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_app_webhook_delivery_log_tenant_time;
      DROP INDEX IF EXISTS idx_app_webhook_delivery_log_app_time;
      DROP TABLE IF EXISTS app_webhook_delivery_log CASCADE;
    `);
  }
}
