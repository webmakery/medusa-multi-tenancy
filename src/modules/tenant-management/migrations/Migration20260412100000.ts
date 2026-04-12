import { Migration } from '@mikro-orm/migrations';

export class Migration20260412100000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS tenant (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL UNIQUE,
        slug VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        owner_email VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_tenant_id ON tenant(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_slug ON tenant(slug);
      CREATE INDEX IF NOT EXISTS idx_tenant_owner_email ON tenant(owner_email);

      CREATE TABLE IF NOT EXISTS tenant_membership (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, user_email)
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_membership_tenant_id ON tenant_membership(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_membership_user_email ON tenant_membership(user_email);

      CREATE TABLE IF NOT EXISTS tenant_invitation (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
        invitation_token UUID NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
        invited_by VARCHAR(255),
        accepted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_tenant_id ON tenant_invitation(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_email ON tenant_invitation(email);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_status ON tenant_invitation(status);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP TABLE IF EXISTS tenant_invitation CASCADE;
      DROP TABLE IF EXISTS tenant_membership CASCADE;
      DROP TABLE IF EXISTS tenant CASCADE;
    `);
  }
}
