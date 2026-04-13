import { Migration } from '@mikro-orm/migrations';

export class Migration20260413120000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      UPDATE tenant_membership
      SET role = 'member'
      WHERE role = 'staff';

      UPDATE tenant_invitation
      SET role = 'member'
      WHERE role = 'staff';

      ALTER TABLE tenant_membership DROP CONSTRAINT IF EXISTS tenant_membership_role_check;
      ALTER TABLE tenant_membership
      ADD CONSTRAINT tenant_membership_role_check
      CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

      ALTER TABLE tenant_invitation DROP CONSTRAINT IF EXISTS tenant_invitation_role_check;
      ALTER TABLE tenant_invitation
      ADD CONSTRAINT tenant_invitation_role_check
      CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      UPDATE tenant_membership
      SET role = 'staff'
      WHERE role = 'member';

      UPDATE tenant_invitation
      SET role = 'staff'
      WHERE role = 'member';

      ALTER TABLE tenant_membership DROP CONSTRAINT IF EXISTS tenant_membership_role_check;
      ALTER TABLE tenant_membership
      ADD CONSTRAINT tenant_membership_role_check
      CHECK (role IN ('owner', 'admin', 'staff'));

      ALTER TABLE tenant_invitation DROP CONSTRAINT IF EXISTS tenant_invitation_role_check;
      ALTER TABLE tenant_invitation
      ADD CONSTRAINT tenant_invitation_role_check
      CHECK (role IN ('owner', 'admin', 'staff'));
    `);
  }
}
