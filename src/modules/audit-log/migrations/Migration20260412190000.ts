import { Migration } from '@mikro-orm/migrations';

export class Migration20260412190000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY,
        actor VARCHAR(255) NOT NULL,
        tenant_id UUID NOT NULL,
        action VARCHAR(128) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        payload_hash VARCHAR(128) NOT NULL,
        event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_timestamp ON audit_log(tenant_id, event_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_audit_log_action;
      DROP INDEX IF EXISTS idx_audit_log_tenant_timestamp;
      DROP TABLE IF EXISTS audit_log CASCADE;
    `);
  }
}
