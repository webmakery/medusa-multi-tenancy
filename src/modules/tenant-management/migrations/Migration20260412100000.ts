import { Migration } from '@mikro-orm/migrations';

export class Migration20260412100000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS tenant (
        id UUID PRIMARY KEY,
        slug VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        owner_email VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE tenant ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      UPDATE tenant
      SET tenant_id = id
      WHERE tenant_id IS NULL;

      ALTER TABLE tenant ALTER COLUMN tenant_id SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_tenant_id_unique ON tenant(tenant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_slug_unique ON tenant(slug);
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

      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS role VARCHAR(32);
      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE tenant_membership ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_membership_tenant_id_user_email_unique
        ON tenant_membership(tenant_id, user_email);
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

      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS role VARCHAR(32);
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS invitation_token UUID;
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending';
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255);
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE tenant_invitation ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invitation_invitation_token_unique
        ON tenant_invitation(invitation_token);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_tenant_id ON tenant_invitation(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_email ON tenant_invitation(email);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_status ON tenant_invitation(status);
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      DROP INDEX IF EXISTS idx_tenant_invitation_status;
      DROP INDEX IF EXISTS idx_tenant_invitation_email;
      DROP INDEX IF EXISTS idx_tenant_invitation_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_invitation_invitation_token_unique;

      DROP INDEX IF EXISTS idx_tenant_membership_user_email;
      DROP INDEX IF EXISTS idx_tenant_membership_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_membership_tenant_id_user_email_unique;

      DROP INDEX IF EXISTS idx_tenant_owner_email;
      DROP INDEX IF EXISTS idx_tenant_slug;
      DROP INDEX IF EXISTS idx_tenant_tenant_id;
      DROP INDEX IF EXISTS idx_tenant_slug_unique;
      DROP INDEX IF EXISTS idx_tenant_tenant_id_unique;

      DROP TABLE IF EXISTS tenant_invitation CASCADE;
      DROP TABLE IF EXISTS tenant_membership CASCADE;
      DROP TABLE IF EXISTS tenant CASCADE;
    `);
  }
}
