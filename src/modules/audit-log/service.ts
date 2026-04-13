import { createHash, randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import AuditLogEntry from './models/audit-log-entry';

interface RecordAuditEventInput {
  actor?: string | null;
  tenant_id: string;
  action: string;
  resource_id: string;
  payload?: Record<string, unknown> | null;
  timestamp?: string | Date;
}

class AuditLogModuleService extends MedusaService({
  AuditLogEntry,
}) {
  private getKnex(): Knex {
    return (this as any).__container__[ContainerRegistrationKeys.PG_CONNECTION] as Knex;
  }

  async recordEvent(input: RecordAuditEventInput) {
    const knex = this.getKnex();
    const eventTimestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    const payload = input.payload || {};
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    await knex('audit_log').insert({
      id: randomUUID(),
      actor: input.actor?.trim().toLowerCase() || 'system',
      tenant_id: input.tenant_id,
      action: input.action,
      resource_id: input.resource_id,
      payload_hash: payloadHash,
      event_timestamp: eventTimestamp.toISOString(),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }
}

export default AuditLogModuleService;
