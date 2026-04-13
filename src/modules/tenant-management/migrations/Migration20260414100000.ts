import { Migration } from '@mikro-orm/migrations';

export class Migration20260414100000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS tenant_signup_session (
        id UUID PRIMARY KEY,
        tenant_id UUID,
        tenant_name VARCHAR(255) NOT NULL,
        tenant_slug VARCHAR(255) NOT NULL,
        owner_email VARCHAR(255) NOT NULL UNIQUE,
        password_secret TEXT,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        owner_user_id VARCHAR(255),
        verification_token_hash VARCHAR(128) NOT NULL UNIQUE,
        verification_expires_at TIMESTAMPTZ NOT NULL,
        email_verified_at TIMESTAMPTZ,
        tenant_created_at TIMESTAMPTZ,
        owner_assigned_at TIMESTAMPTZ,
        first_project_setup_at TIMESTAMPTZ,
        current_step VARCHAR(64) NOT NULL DEFAULT 'signup_submitted',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_signup_session_tenant_id ON tenant_signup_session(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_signup_session_step ON tenant_signup_session(current_step);
      CREATE INDEX IF NOT EXISTS idx_tenant_signup_session_created_at ON tenant_signup_session(created_at DESC);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_tenant_signup_session_created_at;
      DROP INDEX IF EXISTS idx_tenant_signup_session_step;
      DROP INDEX IF EXISTS idx_tenant_signup_session_tenant_id;
      DROP TABLE IF EXISTS tenant_signup_session CASCADE;
    `);
  }
}
