import { Migration } from '@mikro-orm/migrations';

/**
 * Create tenant table used by admin onboarding API.
 */
export class Migration20260412103000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS tenant (
        id UUID PRIMARY KEY,
        slug VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        owner_email VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_tenant_slug ON tenant(slug);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_tenant_owner_email ON tenant(owner_email);');
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS tenant;');
  }
}
