import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import { AUDIT_LOG_MODULE } from '../audit-log';
import AuditLogModuleService from '../audit-log/service';
import TenantInvitation from './models/tenant-invitation';
import TenantMembership from './models/tenant-membership';

export type TenantRole = 'owner' | 'admin' | 'staff';

const ALLOWED_ROLES: TenantRole[] = ['owner', 'admin', 'staff'];

class TenantManagementModuleService extends MedusaService({
  TenantMembership,
  TenantInvitation,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  private normalizeRole(role?: string): TenantRole {
    if (!role || !ALLOWED_ROLES.includes(role as TenantRole)) {
      return 'staff';
    }

    return role as TenantRole;
  }

  private getAuditLogService(): AuditLogModuleService {
    return (this as any).__container__.resolve(AUDIT_LOG_MODULE) as AuditLogModuleService;
  }

  async listTenants() {
    const knex = this.getKnex();

    return knex('tenant')
      .select('id', 'tenant_id', 'name', 'slug', 'owner_email', 'status', 'created_at')
      .orderBy('created_at', 'desc');
  }

  async retrieveTenant(tenantId: string) {
    const knex = this.getKnex();

    return knex('tenant')
      .select('id', 'tenant_id', 'name', 'slug', 'owner_email', 'status', 'created_at', 'updated_at')
      .where({ tenant_id: tenantId })
      .first();
  }

  async createTenant(input: { name: string; slug: string; owner_email: string }) {
    const knex = this.getKnex();

    const existingTenant = await knex('tenant').where({ slug: input.slug }).first();

    if (existingTenant) {
      throw new Error(`A tenant with slug "${input.slug}" already exists.`);
    }

    const tenantId = randomUUID();

    const tenant = {
      id: tenantId,
      tenant_id: tenantId,
      name: input.name,
      slug: input.slug,
      owner_email: input.owner_email,
      status: 'active',
    };

    await knex('tenant').insert(tenant);

    await knex('tenant_membership').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_email: input.owner_email,
      role: 'owner',
      status: 'active',
    });

    return tenant;
  }

  async inviteUserToTenant(input: {
    tenant_id: string;
    email: string;
    role?: string;
    invited_by?: string;
    expires_in_days?: number;
  }) {
    const knex = this.getKnex();

    const role = this.normalizeRole(input.role);
    const expiresInDays = input.expires_in_days && input.expires_in_days > 0 ? input.expires_in_days : 7;
    const token = randomUUID();

    const invitation = {
      id: randomUUID(),
      tenant_id: input.tenant_id,
      email: input.email.trim().toLowerCase(),
      role,
      invitation_token: token,
      status: 'pending',
      invited_by: input.invited_by?.trim().toLowerCase() || null,
      expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    };

    await knex('tenant_invitation').insert(invitation);
    await this.getAuditLogService().recordEvent({
      actor: invitation.invited_by || 'system',
      tenant_id: input.tenant_id,
      action: 'invitation_sent',
      resource_id: invitation.id,
      payload: {
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    });

    return invitation;
  }

  async acceptInvitation(input: { invitation_token: string }) {
    const knex = this.getKnex();

    const invitation = await knex('tenant_invitation')
      .where({ invitation_token: input.invitation_token })
      .first();

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending.');
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new Error('Invitation has expired.');
    }

    const existingMember = await knex('tenant_membership')
      .where({ tenant_id: invitation.tenant_id, user_email: invitation.email })
      .first();

    if (existingMember) {
      await knex('tenant_membership')
        .where({ id: existingMember.id })
        .update({ role: invitation.role, status: 'active', updated_at: knex.fn.now() });
    } else {
      await knex('tenant_membership').insert({
        id: randomUUID(),
        tenant_id: invitation.tenant_id,
        user_email: invitation.email,
        role: invitation.role,
        status: 'active',
      });
    }

    await knex('tenant_invitation')
      .where({ id: invitation.id })
      .update({ status: 'accepted', accepted_at: knex.fn.now(), updated_at: knex.fn.now() });

    await this.getAuditLogService().recordEvent({
      actor: invitation.email,
      tenant_id: invitation.tenant_id,
      action: 'invitation_accepted',
      resource_id: invitation.id,
      payload: {
        email: invitation.email,
        role: invitation.role,
      },
    });

    return {
      tenant_id: invitation.tenant_id,
      email: invitation.email,
      role: invitation.role,
    };
  }

  async listTenantMembers(tenantId: string) {
    const knex = this.getKnex();

    return knex('tenant_membership')
      .select('id', 'tenant_id', 'user_email', 'role', 'status', 'created_at', 'updated_at')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'asc');
  }


  async getTenantMembershipByEmail(input: { tenant_id: string; user_email: string }) {
    const knex = this.getKnex();

    return knex('tenant_membership')
      .select('id', 'tenant_id', 'user_email', 'role', 'status', 'created_at', 'updated_at')
      .where({
        tenant_id: input.tenant_id,
        user_email: input.user_email.trim().toLowerCase(),
      })
      .first();
  }

  async updateMemberRole(input: { tenant_id: string; member_id: string; role: string; actor?: string }) {
    const knex = this.getKnex();

    const role = this.normalizeRole(input.role);

    const member = await knex('tenant_membership')
      .where({ id: input.member_id, tenant_id: input.tenant_id })
      .first();

    if (!member) {
      throw new Error('Member not found.');
    }

    await knex('tenant_membership')
      .where({ id: member.id })
      .update({ role, updated_at: knex.fn.now() });

    await this.getAuditLogService().recordEvent({
      actor: input.actor || 'system',
      tenant_id: input.tenant_id,
      action: 'role_changed',
      resource_id: member.id,
      payload: {
        previous_role: member.role,
        new_role: role,
        user_email: member.user_email,
      },
    });

    return {
      ...member,
      role,
    };
  }

  async deactivateTenant(tenantId: string, actor?: string) {
    const knex = this.getKnex();

    const tenant = await knex('tenant').where({ id: tenantId }).first();

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    await knex('tenant').where({ id: tenantId }).update({ status: 'inactive', updated_at: knex.fn.now() });
    await knex('tenant_membership')
      .where({ tenant_id: tenantId })
      .update({ status: 'inactive', updated_at: knex.fn.now() });

    await this.getAuditLogService().recordEvent({
      actor: actor || 'system',
      tenant_id: tenantId,
      action: 'tenant_deactivated',
      resource_id: tenantId,
      payload: {
        previous_status: tenant.status,
        new_status: 'inactive',
      },
    });

    return {
      ...tenant,
      status: 'inactive',
    };
  }
}

export default TenantManagementModuleService;
