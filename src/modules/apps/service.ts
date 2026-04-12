import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import AppCredential from './models/app-credential';
import AppInstallation from './models/app-installation';
import AppScope from './models/app-scope';
import AppWebhook from './models/app-webhook';

const DEFAULT_EVENTS = ['order.created', 'product.updated', 'customer.created'];

interface InstallAppInput {
  tenant_id: string;
  app_name: string;
  app_identifier: string;
  app_url?: string;
  scopes?: string[];
  webhooks?: Array<{ event_name: string; target_url: string }>;
}

interface PublishEventInput {
  tenant_id?: string;
  event_name: string;
  data: Record<string, unknown>;
}

interface InboundWebhookVerificationInput {
  nonce: string;
  timestamp: string;
}

class AppsModuleService extends MedusaService({
  AppInstallation,
  AppScope,
  AppWebhook,
  AppCredential,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  private createAppSecret() {
    return randomBytes(32).toString('hex');
  }

  private createKeyId() {
    return `app_key_${randomBytes(8).toString('hex')}`;
  }

  private signPayload(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private createInboundSignaturePayload(rawBody: string, input: InboundWebhookVerificationInput) {
    return `${input.timestamp}.${input.nonce}.${rawBody}`;
  }

  async installApp(input: InstallAppInput) {
    const knex = this.getKnex();

    const existing = await knex('app_installation')
      .where({ tenant_id: input.tenant_id, app_identifier: input.app_identifier })
      .first();

    if (existing) {
      throw new Error(`App "${input.app_identifier}" is already installed for this tenant.`);
    }

    const appId = randomUUID();
    const keyId = this.createKeyId();
    const secret = this.createAppSecret();

    const normalizedScopes = Array.from(new Set((input.scopes || []).map((scope) => scope.trim()).filter(Boolean)));
    const requestedWebhooks = input.webhooks || [];
    const defaultWebhooks = DEFAULT_EVENTS.map((event_name) => ({
      event_name,
      target_url: input.app_url || '',
    }));

    const normalizedWebhooks = Array.from(
      new Map(
        [...requestedWebhooks, ...defaultWebhooks]
          .filter((hook) => hook.event_name && hook.target_url)
          .map((hook) => [`${hook.event_name}:${hook.target_url}`, hook])
      ).values()
    );

    await knex.transaction(async (trx) => {
      await trx('app_installation').insert({
        id: appId,
        tenant_id: input.tenant_id,
        app_name: input.app_name,
        app_identifier: input.app_identifier,
        app_url: input.app_url || null,
        status: 'installed',
        installed_at: trx.fn.now(),
      });

      if (normalizedScopes.length) {
        await trx('app_scope').insert(
          normalizedScopes.map((scope) => ({
            id: randomUUID(),
            tenant_id: input.tenant_id,
            app_id: appId,
            scope,
          }))
        );
      }

      if (normalizedWebhooks.length) {
        await trx('app_webhook').insert(
          normalizedWebhooks.map((hook) => ({
            id: randomUUID(),
            tenant_id: input.tenant_id,
            app_id: appId,
            event_name: hook.event_name,
            target_url: hook.target_url,
            is_active: true,
          }))
        );
      }

      await trx('app_credential').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        app_id: appId,
        key_id: keyId,
        secret,
        is_active: true,
      });
    });

    return {
      app_id: appId,
      key_id: keyId,
      secret,
      events: normalizedWebhooks.map((hook) => hook.event_name),
      scopes: normalizedScopes,
    };
  }

  async uninstallApp(tenantId: string, appId: string) {
    const knex = this.getKnex();

    const installation = await knex('app_installation').where({ id: appId, tenant_id: tenantId }).first();

    if (!installation) {
      throw new Error('Installed app not found.');
    }

    await knex.transaction(async (trx) => {
      await trx('app_installation')
        .where({ id: appId, tenant_id: tenantId })
        .update({ status: 'uninstalled', uninstalled_at: trx.fn.now(), updated_at: trx.fn.now() });

      await trx('app_scope').where({ app_id: appId, tenant_id: tenantId }).del();
      await trx('app_webhook').where({ app_id: appId, tenant_id: tenantId }).del();
      await trx('app_credential').where({ app_id: appId, tenant_id: tenantId }).update({ is_active: false, rotated_at: trx.fn.now() });
    });
  }

  async listInstalledApps(tenantId: string) {
    const knex = this.getKnex();

    const apps = await knex('app_installation')
      .where({ tenant_id: tenantId, status: 'installed' })
      .orderBy('installed_at', 'desc');

    if (!apps.length) {
      return [];
    }

    const appIds = apps.map((app) => app.id);

    const [scopes, webhooks, credentials] = await Promise.all([
      knex('app_scope').whereIn('app_id', appIds).andWhere({ tenant_id: tenantId }),
      knex('app_webhook').whereIn('app_id', appIds).andWhere({ tenant_id: tenantId, is_active: true }),
      knex('app_credential').whereIn('app_id', appIds).andWhere({ tenant_id: tenantId, is_active: true }),
    ]);

    return apps.map((app) => ({
      ...app,
      scopes: scopes.filter((scope) => scope.app_id === app.id).map((scope) => scope.scope),
      webhooks: webhooks
        .filter((webhook) => webhook.app_id === app.id)
        .map((webhook) => ({ event_name: webhook.event_name, target_url: webhook.target_url })),
      credential: credentials
        .filter((credential) => credential.app_id === app.id)
        .map((credential) => ({ key_id: credential.key_id, rotated_at: credential.rotated_at }))[0] || null,
    }));
  }

  async rotateAppSecret(tenantId: string, appId: string) {
    const knex = this.getKnex();

    const app = await knex('app_installation').where({ id: appId, tenant_id: tenantId, status: 'installed' }).first();

    if (!app) {
      throw new Error('Installed app not found.');
    }

    const nextSecret = this.createAppSecret();
    const nextKeyId = this.createKeyId();

    await knex.transaction(async (trx) => {
      await trx('app_credential').where({ app_id: appId, tenant_id: tenantId, is_active: true }).update({
        is_active: false,
        rotated_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await trx('app_credential').insert({
        id: randomUUID(),
        tenant_id: tenantId,
        app_id: appId,
        key_id: nextKeyId,
        secret: nextSecret,
        is_active: true,
      });
    });

    return {
      app_id: appId,
      key_id: nextKeyId,
      secret: nextSecret,
    };
  }

  async verifyInboundWebhook(
    appId: string,
    rawBody: string,
    signature: string,
    input: InboundWebhookVerificationInput
  ) {
    const knex = this.getKnex();

    const credential = await knex('app_credential').where({ app_id: appId, is_active: true }).orderBy('created_at', 'desc').first();

    if (!credential) {
      return false;
    }

    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const signedPayload = this.createInboundSignaturePayload(rawBody, input);
    const expected = this.signPayload(signedPayload, credential.secret);

    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  async publishEventToSubscribers(input: PublishEventInput) {
    const knex = this.getKnex();

    const baseQuery = knex('app_webhook')
      .join('app_installation', 'app_installation.id', 'app_webhook.app_id')
      .join('app_credential', 'app_credential.app_id', 'app_installation.id')
      .where({
        'app_webhook.event_name': input.event_name,
        'app_webhook.is_active': true,
        'app_installation.status': 'installed',
        'app_credential.is_active': true,
      })
      .select(
        'app_webhook.app_id',
        'app_webhook.target_url',
        'app_installation.tenant_id',
        'app_credential.secret',
        'app_credential.key_id'
      );

    if (input.tenant_id) {
      baseQuery.andWhere('app_installation.tenant_id', input.tenant_id);
    }

    const subscriptions = await baseQuery;

    const payload = JSON.stringify({
      event: input.event_name,
      data: input.data,
      sent_at: new Date().toISOString(),
    });

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const signature = this.signPayload(payload, subscription.secret);

        await fetch(subscription.target_url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-app-id': subscription.app_id,
            'x-app-key': subscription.key_id,
            'x-app-signature': `sha256=${signature}`,
            'x-tenant-id': subscription.tenant_id,
          },
          body: payload,
        });
      })
    );

    return { delivered: subscriptions.length };
  }
}

export default AppsModuleService;
