import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import ThemeConfig from './models/theme-config';
import ThemeMetadata from './models/theme-metadata';
import ThemePublishStatus from './models/theme-publish-status';

interface UploadAndActivateThemeInput {
  tenant_id: string;
  name: string;
  slug: string;
  version?: string;
  author?: string;
  description?: string;
  config_json?: Record<string, any>;
}

interface EditThemeSettingsInput {
  tenant_id: string;
  config_json: Record<string, any>;
  theme_id?: string;
}

interface SetThemePublishStatusInput {
  tenant_id: string;
  publish: boolean;
  theme_id?: string;
}

class ThemeModuleService extends MedusaService({
  ThemeMetadata,
  ThemeConfig,
  ThemePublishStatus,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  async uploadAndActivateTheme(input: UploadAndActivateThemeInput) {
    const knex = this.getKnex();

    const themeId = randomUUID();

    await knex.transaction(async (trx) => {
      await trx('theme_metadata').where({ tenant_id: input.tenant_id }).update({ is_active: false, updated_at: trx.fn.now() });

      await trx('theme_metadata').insert({
        id: themeId,
        tenant_id: input.tenant_id,
        name: input.name,
        slug: input.slug,
        version: input.version || '1.0.0',
        author: input.author || null,
        description: input.description || null,
        is_active: true,
      });

      await trx('theme_config').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        theme_id: themeId,
        config_json: input.config_json || {},
      });

      await trx('theme_publish_status').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        theme_id: themeId,
        status: 'unpublished',
        unpublished_at: trx.fn.now(),
      });
    });

    return this.getThemeById(input.tenant_id, themeId);
  }

  async editThemeSettings(input: EditThemeSettingsInput) {
    const knex = this.getKnex();

    const theme = input.theme_id
      ? await knex('theme_metadata').where({ id: input.theme_id, tenant_id: input.tenant_id }).first()
      : await knex('theme_metadata').where({ tenant_id: input.tenant_id, is_active: true }).first();

    if (!theme) {
      throw new Error('Active theme not found for tenant.');
    }

    const existingConfig = await knex('theme_config')
      .where({ theme_id: theme.id, tenant_id: input.tenant_id })
      .first();

    if (existingConfig) {
      await knex('theme_config')
        .where({ id: existingConfig.id })
        .update({ config_json: input.config_json, updated_at: knex.fn.now() });
    } else {
      await knex('theme_config').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        theme_id: theme.id,
        config_json: input.config_json,
      });
    }

    return this.getThemeById(input.tenant_id, theme.id);
  }

  async setThemePublishStatus(input: SetThemePublishStatusInput) {
    const knex = this.getKnex();

    const theme = input.theme_id
      ? await knex('theme_metadata').where({ id: input.theme_id, tenant_id: input.tenant_id }).first()
      : await knex('theme_metadata').where({ tenant_id: input.tenant_id, is_active: true }).first();

    if (!theme) {
      throw new Error('Active theme not found for tenant.');
    }

    const nowValue = knex.fn.now();

    const existingStatus = await knex('theme_publish_status')
      .where({ theme_id: theme.id, tenant_id: input.tenant_id })
      .first();

    if (existingStatus) {
      await knex('theme_publish_status')
        .where({ id: existingStatus.id })
        .update({
          status: input.publish ? 'published' : 'unpublished',
          published_at: input.publish ? nowValue : existingStatus.published_at,
          unpublished_at: input.publish ? existingStatus.unpublished_at : nowValue,
          updated_at: knex.fn.now(),
        });
    } else {
      await knex('theme_publish_status').insert({
        id: randomUUID(),
        tenant_id: input.tenant_id,
        theme_id: theme.id,
        status: input.publish ? 'published' : 'unpublished',
        published_at: input.publish ? nowValue : null,
        unpublished_at: input.publish ? null : nowValue,
      });
    }

    return this.getThemeById(input.tenant_id, theme.id);
  }

  async getActiveThemeForTenant(tenantId: string) {
    const knex = this.getKnex();

    const theme = await knex('theme_metadata')
      .where({ tenant_id: tenantId, is_active: true })
      .orderBy('created_at', 'desc')
      .first();

    if (!theme) {
      return null;
    }

    return this.getThemeById(tenantId, theme.id);
  }

  private async getThemeById(tenantId: string, themeId: string) {
    const knex = this.getKnex();

    const [metadata, config, publish_status] = await Promise.all([
      knex('theme_metadata').where({ id: themeId, tenant_id: tenantId }).first(),
      knex('theme_config').where({ theme_id: themeId, tenant_id: tenantId }).first(),
      knex('theme_publish_status').where({ theme_id: themeId, tenant_id: tenantId }).first(),
    ]);

    return {
      metadata,
      config: {
        ...(typeof config?.config_json === 'string' ? JSON.parse(config.config_json) : config?.config_json || {}),
      },
      publish_status,
    };
  }
}

export default ThemeModuleService;
