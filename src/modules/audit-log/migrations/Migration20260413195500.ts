import { Migration } from '@mikro-orm/migrations';

export class Migration20260413195500 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log rows are immutable';
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_audit_log_immutable_update ON audit_log;
      CREATE TRIGGER trg_audit_log_immutable_update
      BEFORE UPDATE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();

      DROP TRIGGER IF EXISTS trg_audit_log_immutable_delete ON audit_log;
      CREATE TRIGGER trg_audit_log_immutable_delete
      BEFORE DELETE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();

      CREATE INDEX IF NOT EXISTS idx_audit_log_admin_security_actions
      ON audit_log(tenant_id, action, event_timestamp DESC)
      WHERE action IN ('role_changed', 'ownership_transferred', 'billing_status_changed');
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_audit_log_admin_security_actions;
      DROP TRIGGER IF EXISTS trg_audit_log_immutable_delete ON audit_log;
      DROP TRIGGER IF EXISTS trg_audit_log_immutable_update ON audit_log;
      DROP FUNCTION IF EXISTS prevent_audit_log_mutation;
    `);
  }
}
