import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import { AUDIT_LOG_MODULE } from '../audit-log';
import AuditLogModuleService from '../audit-log/service';
import { BILLING_MODULE } from '../billing';
import BillingModuleService from '../billing/service';
import TenantInvitation from './models/tenant-invitation';
import TenantMembership from './models/tenant-membership';
import { TENANT_DELETION_RETENTION_DAYS, TenantStatus } from './lifecycle';

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

const ALLOWED_ROLES: TenantRole[] = ['owner', 'admin', 'member', 'viewer'];

class TenantManagementModuleService extends MedusaService({
  TenantMembership,
  TenantInvitation,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  private normalizeRole(role?: string): TenantRole {
    const normalizedRole = role?.trim().toLowerCase();

    if (normalizedRole === 'staff') {
      return 'member';
    }

    if (!normalizedRole || !ALLOWED_ROLES.includes(normalizedRole as TenantRole)) {
      return 'member';
    }

    return normalizedRole as TenantRole;
  }

  private getAuditLogService(): AuditLogModuleService {
    return (this as any).__container__.resolve(AUDIT_LOG_MODULE) as AuditLogModuleService;
  }

  private getBillingService(): BillingModuleService {
    return (this as any).__container__.resolve(BILLING_MODULE) as BillingModuleService;
  }

  async listTenants() {
    const knex = this.getKnex();

    // tenant-scope-ignore: tenant directory endpoint is intentionally cross-tenant for authorized admins.
    return knex('tenant')
      .select('id', 'tenant_id', 'name', 'slug', 'owner_email', 'status', 'deletion_requested_at', 'scheduled_purge_at', 'created_at')
      .orderBy('created_at', 'desc');
  }

  async retrieveTenant(tenantId: string) {
    const knex = this.getKnex();

    // tenant-scope-ignore: tenant lifecycle endpoints retrieve tenants by explicit tenant id.
    return knex('tenant')
      .select(
        'id',
        'tenant_id',
        'name',
        'slug',
        'owner_email',
        'status',
        'settings_json',
        'deletion_requested_at',
        'scheduled_purge_at',
        'deleted_at',
        'created_at',
        'updated_at'
      )
      .where({ tenant_id: tenantId })
      .first();
  }

  async getTenantStatus(tenantId: string): Promise<TenantStatus | null> {
    const knex = this.getKnex();
    const tenant = await knex('tenant').select('status').where({ tenant_id: tenantId }).first();
    return (tenant?.status || null) as TenantStatus | null;
  }

  async createTenant(input: { name: string; slug: string; owner_email: string }) {
    const knex = this.getKnex();

    // tenant-scope-ignore: uniqueness check happens before a tenant_id exists for the new tenant.
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
      settings_json: {
        locale: 'en-US',
        timezone: 'UTC',
        currency_code: 'usd',
        lifecycle: {
          billing_mode: 'preserve_on_suspension',
          retention_days: TENANT_DELETION_RETENTION_DAYS,
        },
      },
    };

    await knex('tenant').insert(tenant);

    await knex('tenant_membership').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_email: input.owner_email,
      role: 'owner',
      status: 'active',
    });

    await this.getBillingService().ensureTenantBilling(tenantId);

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
    const tokenNonce = randomUUID();
    const token = `${input.tenant_id}.${role}.${tokenNonce}`;

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

    // tenant-scope-ignore: invitation token lookup is global by design and then constrained by invitation.tenant_id.
    const invitation = await knex('tenant_invitation')
      .where({ invitation_token: input.invitation_token })
      .first();

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending.');
    }

    const expectedTokenPrefix = `${invitation.tenant_id}.${invitation.role}.`;
    if (!String(invitation.invitation_token).startsWith(expectedTokenPrefix)) {
      throw new Error('Invitation token is invalid for this tenant or role.');
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

    if (role === 'owner' && member.role !== 'owner') {
      throw new Error('Use ownership transfer to assign owner role.');
    }

    if (member.role === 'owner' && role !== 'owner') {
      const ownerCountResult = await knex('tenant_membership')
        .where({ tenant_id: input.tenant_id, status: 'active', role: 'owner' })
        .count<{ count: string }[]>('* as count')
        .first();

      const ownerCount = Number(ownerCountResult?.count || 0);

      if (ownerCount <= 1) {
        throw new Error('Cannot downgrade the last owner. Transfer ownership first.');
      }
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

  async removeMember(input: { tenant_id: string; member_id: string; actor?: string }) {
    const knex = this.getKnex();

    const member = await knex('tenant_membership')
      .where({ id: input.member_id, tenant_id: input.tenant_id })
      .first();

    if (!member) {
      throw new Error('Member not found.');
    }

    if (member.role === 'owner') {
      const ownerCountResult = await knex('tenant_membership')
        .where({ tenant_id: input.tenant_id, status: 'active', role: 'owner' })
        .count<{ count: string }[]>('* as count')
        .first();

      const ownerCount = Number(ownerCountResult?.count || 0);

      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last owner. Transfer ownership first.');
      }
    }

    await knex('tenant_membership').where({ id: member.id }).del();

    await this.getAuditLogService().recordEvent({
      actor: input.actor || 'system',
      tenant_id: input.tenant_id,
      action: 'member_removed',
      resource_id: member.id,
      payload: {
        user_email: member.user_email,
        role: member.role,
      },
    });

    return member;
  }

  async transferOwnership(input: { tenant_id: string; actor_email: string; target_member_id: string }) {
    const knex = this.getKnex();
    const actorEmail = input.actor_email.trim().toLowerCase();

    const actorMembership = await knex('tenant_membership')
      .where({ tenant_id: input.tenant_id, user_email: actorEmail, status: 'active' })
      .first();

    if (!actorMembership || actorMembership.role !== 'owner') {
      throw new Error('Only an active owner can transfer ownership.');
    }

    const targetMembership = await knex('tenant_membership')
      .where({ tenant_id: input.tenant_id, id: input.target_member_id, status: 'active' })
      .first();

    if (!targetMembership) {
      throw new Error('Target member not found.');
    }

    if (targetMembership.id === actorMembership.id) {
      throw new Error('Choose a different member to transfer ownership.');
    }

    await knex.transaction(async (trx) => {
      // tenant-scope-ignore: ownership transfer updates two explicit membership ids in one transaction.
      await trx('tenant_membership')
        .where({ id: actorMembership.id })
        .update({ role: 'admin', updated_at: trx.fn.now() });

      await trx('tenant_membership')
        .where({ id: targetMembership.id })
        .update({ role: 'owner', updated_at: trx.fn.now() });
    });

    await this.getAuditLogService().recordEvent({
      actor: actorEmail,
      tenant_id: input.tenant_id,
      action: 'ownership_transferred',
      resource_id: targetMembership.id,
      payload: {
        from_email: actorMembership.user_email,
        to_email: targetMembership.user_email,
      },
    });

    return {
      previous_owner: actorMembership.user_email,
      new_owner: targetMembership.user_email,
    };
  }

  async listActiveMembershipsByEmail(userEmail: string) {
    const knex = this.getKnex();
    const normalizedEmail = userEmail.trim().toLowerCase();

    // tenant-scope-ignore: tenant switcher needs cross-tenant memberships for a single authenticated actor.
    return knex('tenant_membership')
      .join('tenant', 'tenant.tenant_id', 'tenant_membership.tenant_id')
      .select('tenant_membership.tenant_id', 'tenant_membership.role', 'tenant_membership.status')
      .where({
        'tenant_membership.user_email': normalizedEmail,
        'tenant_membership.status': 'active',
        'tenant.status': 'active',
      })
      .orderBy('tenant_membership.created_at', 'asc');
  }

  async deactivateTenant(tenantId: string, actor?: string) {
    const knex = this.getKnex();

    // tenant-scope-ignore: admin action targets tenant by primary id to lock the whole tenant account.
    const tenant = await knex('tenant').where({ id: tenantId }).first();

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    // tenant-scope-ignore: deletion scheduling applies to the explicitly targeted tenant id.
    // tenant-scope-ignore: deletion scheduling applies to the explicitly targeted tenant id.
    await knex('tenant').where({ id: tenantId }).update({
      status: 'inactive',
      deactivated_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
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

  async suspendTenant(tenantId: string, actor?: string) {
    const knex = this.getKnex();
    // tenant-scope-ignore: admin lifecycle action targets a specific tenant id.
    const tenant = await knex('tenant').where({ id: tenantId }).first();

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    await knex('tenant').where({ id: tenantId }).update({
      status: 'suspended',
      suspended_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    await this.getAuditLogService().recordEvent({
      actor: actor || 'system',
      tenant_id: tenantId,
      action: 'tenant_suspended',
      resource_id: tenantId,
      payload: {
        previous_status: tenant.status,
        new_status: 'suspended',
        access_blocked: true,
        billing_preserved: true,
      },
    });

    return {
      ...tenant,
      status: 'suspended',
    };
  }

  async reactivateTenant(tenantId: string, actor?: string) {
    const knex = this.getKnex();
    // tenant-scope-ignore: admin lifecycle action targets a specific tenant id.
    const tenant = await knex('tenant').where({ id: tenantId }).first();

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    if (tenant.status === 'pending_deletion' || tenant.status === 'deleted') {
      throw new Error('Tenant cannot be reactivated while deletion is in progress.');
    }

    await knex('tenant').where({ id: tenantId }).update({
      status: 'active',
      updated_at: knex.fn.now(),
    });

    await knex('tenant_membership').where({ tenant_id: tenantId }).update({
      status: 'active',
      updated_at: knex.fn.now(),
    });

    await this.getAuditLogService().recordEvent({
      actor: actor || 'system',
      tenant_id: tenantId,
      action: 'tenant_reactivated',
      resource_id: tenantId,
      payload: {
        previous_status: tenant.status,
        new_status: 'active',
      },
    });

    return {
      ...tenant,
      status: 'active',
    };
  }

  async requestTenantDeletion(tenantId: string, actor?: string) {
    const knex = this.getKnex();
    // tenant-scope-ignore: admin lifecycle action targets a specific tenant id.
    const tenant = await knex('tenant').where({ id: tenantId }).first();

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    if (tenant.legal_hold === true) {
      throw new Error('Tenant is under legal hold and cannot be scheduled for deletion.');
    }

    // tenant-scope-ignore: deletion scheduling applies to the explicitly targeted tenant id.
    await knex('tenant').where({ id: tenantId }).update({
      status: 'pending_deletion',
      deletion_requested_at: knex.fn.now(),
      scheduled_purge_at: knex.raw(`NOW() + INTERVAL '${TENANT_DELETION_RETENTION_DAYS} days'`),
      updated_at: knex.fn.now(),
    });

    await this.getAuditLogService().recordEvent({
      actor: actor || 'system',
      tenant_id: tenantId,
      action: 'tenant_deletion_requested',
      resource_id: tenantId,
      payload: {
        previous_status: tenant.status,
        new_status: 'pending_deletion',
        retention_days: TENANT_DELETION_RETENTION_DAYS,
      },
    });

    return {
      ...tenant,
      status: 'pending_deletion',
    };
  }
}

export default TenantManagementModuleService;
