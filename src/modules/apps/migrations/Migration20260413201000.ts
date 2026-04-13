import { Migration } from '@mikro-orm/migrations';

export class Migration20260413201000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      ALTER TABLE app_webhook_delivery_log
      DROP CONSTRAINT IF EXISTS app_webhook_delivery_log_delivery_status_check;

      ALTER TABLE app_webhook_delivery_log
      ADD CONSTRAINT app_webhook_delivery_log_delivery_status_check
      CHECK (delivery_status IN ('delivered', 'failed', 'dead_letter'));

      CREATE INDEX IF NOT EXISTS idx_app_webhook_delivery_log_tenant_status_time
      ON app_webhook_delivery_log(tenant_id, delivery_status, delivered_at DESC);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_app_webhook_delivery_log_tenant_status_time;

      ALTER TABLE app_webhook_delivery_log
      DROP CONSTRAINT IF EXISTS app_webhook_delivery_log_delivery_status_check;

      ALTER TABLE app_webhook_delivery_log
      ADD CONSTRAINT app_webhook_delivery_log_delivery_status_check
      CHECK (delivery_status IN ('delivered', 'failed'));
    `);
  }
}
