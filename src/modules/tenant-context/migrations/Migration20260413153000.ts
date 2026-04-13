import { Migration } from '@mikro-orm/migrations';

export class Migration20260413153000 extends Migration {
  async up(): Promise<void> {
    await this.execute(`
      DO $$
      DECLARE
        fallback_tenant UUID;
      BEGIN
        SELECT COALESCE(
          (SELECT tenant_id FROM tenant ORDER BY created_at ASC LIMIT 1),
          (SELECT id FROM tenant ORDER BY created_at ASC LIMIT 1)
        ) INTO fallback_tenant;

        IF fallback_tenant IS NOT NULL THEN
          UPDATE app_installation SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE app_scope SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE app_webhook SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE app_credential SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE app_webhook_delivery_log SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;

          UPDATE theme_metadata SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE theme_config SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE theme_publish_status SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;

          UPDATE analytics_event SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE analytics_rollup_daily SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE analytics_top_product_daily SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;

          UPDATE audit_log SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE tenant_membership SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
          UPDATE tenant_invitation SET tenant_id = fallback_tenant WHERE tenant_id IS NULL;
        END IF;
      END $$;

      ALTER TABLE app_installation ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE app_scope ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE app_webhook ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE app_credential ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE app_webhook_delivery_log ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE theme_metadata ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE theme_config ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE theme_publish_status ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE analytics_event ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE analytics_rollup_daily ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE analytics_top_product_daily ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE audit_log ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE tenant_membership ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE tenant_invitation ALTER COLUMN tenant_id SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_installation_tenant_id_id ON app_installation(tenant_id, id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_metadata_tenant_id_id ON theme_metadata(tenant_id, id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_tenant_id_id ON tenant(tenant_id, id);

      CREATE INDEX IF NOT EXISTS idx_app_scope_tenant_app_id ON app_scope(tenant_id, app_id);
      CREATE INDEX IF NOT EXISTS idx_app_scope_tenant_scope ON app_scope(tenant_id, scope);
      CREATE INDEX IF NOT EXISTS idx_app_webhook_tenant_event_active ON app_webhook(tenant_id, event_name, is_active);
      CREATE INDEX IF NOT EXISTS idx_app_credential_tenant_app_active ON app_credential(tenant_id, app_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_theme_config_tenant_theme_id ON theme_config(tenant_id, theme_id);
      CREATE INDEX IF NOT EXISTS idx_theme_publish_status_tenant_theme_status ON theme_publish_status(tenant_id, theme_id, status);
      CREATE INDEX IF NOT EXISTS idx_analytics_event_tenant_type_date ON analytics_event(tenant_id, event_type, event_date);
      CREATE INDEX IF NOT EXISTS idx_analytics_top_product_tenant_date_gmv ON analytics_top_product_daily(tenant_id, rollup_date, gmv_cents DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action_timestamp ON audit_log(tenant_id, action, event_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_tenant_membership_tenant_status ON tenant_membership(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_tenant_invitation_tenant_status_email ON tenant_invitation(tenant_id, status, email);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'app_scope_tenant_app_fk'
        ) THEN
          ALTER TABLE app_scope
            ADD CONSTRAINT app_scope_tenant_app_fk
            FOREIGN KEY (tenant_id, app_id) REFERENCES app_installation(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'app_webhook_tenant_app_fk'
        ) THEN
          ALTER TABLE app_webhook
            ADD CONSTRAINT app_webhook_tenant_app_fk
            FOREIGN KEY (tenant_id, app_id) REFERENCES app_installation(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'app_credential_tenant_app_fk'
        ) THEN
          ALTER TABLE app_credential
            ADD CONSTRAINT app_credential_tenant_app_fk
            FOREIGN KEY (tenant_id, app_id) REFERENCES app_installation(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'app_webhook_delivery_log_tenant_app_fk'
        ) THEN
          ALTER TABLE app_webhook_delivery_log
            ADD CONSTRAINT app_webhook_delivery_log_tenant_app_fk
            FOREIGN KEY (tenant_id, app_id) REFERENCES app_installation(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'theme_config_tenant_theme_fk'
        ) THEN
          ALTER TABLE theme_config
            ADD CONSTRAINT theme_config_tenant_theme_fk
            FOREIGN KEY (tenant_id, theme_id) REFERENCES theme_metadata(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'theme_publish_status_tenant_theme_fk'
        ) THEN
          ALTER TABLE theme_publish_status
            ADD CONSTRAINT theme_publish_status_tenant_theme_fk
            FOREIGN KEY (tenant_id, theme_id) REFERENCES theme_metadata(tenant_id, id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenant_membership_tenant_fk'
        ) THEN
          ALTER TABLE tenant_membership
            ADD CONSTRAINT tenant_membership_tenant_fk
            FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitation_tenant_fk'
        ) THEN
          ALTER TABLE tenant_invitation
            ADD CONSTRAINT tenant_invitation_tenant_fk
            FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
            ON DELETE CASCADE;
        END IF;
      END $$;

      DO $$
      DECLARE
        table_name TEXT;
        tables TEXT[] := ARRAY[
          'app_installation',
          'app_scope',
          'app_webhook',
          'app_credential',
          'app_webhook_delivery_log',
          'theme_metadata',
          'theme_config',
          'theme_publish_status',
          'analytics_event',
          'analytics_rollup_daily',
          'analytics_top_product_daily',
          'audit_log',
          'tenant_membership',
          'tenant_invitation'
        ];
      BEGIN
        FOREACH table_name IN ARRAY tables LOOP
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

          EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON %I', table_name, table_name);
          EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON %I', table_name, table_name);
          EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON %I', table_name, table_name);
          EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON %I', table_name, table_name);

          EXECUTE format(
            'CREATE POLICY %I_tenant_select ON %I FOR SELECT USING (tenant_id::text = current_setting(''app.current_tenant'', true) OR current_setting(''app.current_tenant'', true) IS NULL OR current_setting(''app.current_tenant'', true) = '''')',
            table_name,
            table_name
          );

          EXECUTE format(
            'CREATE POLICY %I_tenant_insert ON %I FOR INSERT WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true) OR current_setting(''app.current_tenant'', true) IS NULL OR current_setting(''app.current_tenant'', true) = '''')',
            table_name,
            table_name
          );

          EXECUTE format(
            'CREATE POLICY %I_tenant_update ON %I FOR UPDATE USING (tenant_id::text = current_setting(''app.current_tenant'', true) OR current_setting(''app.current_tenant'', true) IS NULL OR current_setting(''app.current_tenant'', true) = '''') WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true) OR current_setting(''app.current_tenant'', true) IS NULL OR current_setting(''app.current_tenant'', true) = '''')',
            table_name,
            table_name
          );

          EXECUTE format(
            'CREATE POLICY %I_tenant_delete ON %I FOR DELETE USING (tenant_id::text = current_setting(''app.current_tenant'', true) OR current_setting(''app.current_tenant'', true) IS NULL OR current_setting(''app.current_tenant'', true) = '''')',
            table_name,
            table_name
          );
        END LOOP;
      END $$;
    `);
  }

  async down(): Promise<void> {
    await this.execute(`
      ALTER TABLE app_scope DROP CONSTRAINT IF EXISTS app_scope_tenant_app_fk;
      ALTER TABLE app_webhook DROP CONSTRAINT IF EXISTS app_webhook_tenant_app_fk;
      ALTER TABLE app_credential DROP CONSTRAINT IF EXISTS app_credential_tenant_app_fk;
      ALTER TABLE app_webhook_delivery_log DROP CONSTRAINT IF EXISTS app_webhook_delivery_log_tenant_app_fk;
      ALTER TABLE theme_config DROP CONSTRAINT IF EXISTS theme_config_tenant_theme_fk;
      ALTER TABLE theme_publish_status DROP CONSTRAINT IF EXISTS theme_publish_status_tenant_theme_fk;
      ALTER TABLE tenant_membership DROP CONSTRAINT IF EXISTS tenant_membership_tenant_fk;
      ALTER TABLE tenant_invitation DROP CONSTRAINT IF EXISTS tenant_invitation_tenant_fk;

      DROP INDEX IF EXISTS idx_tenant_invitation_tenant_status_email;
      DROP INDEX IF EXISTS idx_tenant_membership_tenant_status;
      DROP INDEX IF EXISTS idx_audit_log_tenant_action_timestamp;
      DROP INDEX IF EXISTS idx_analytics_top_product_tenant_date_gmv;
      DROP INDEX IF EXISTS idx_analytics_event_tenant_type_date;
      DROP INDEX IF EXISTS idx_theme_publish_status_tenant_theme_status;
      DROP INDEX IF EXISTS idx_theme_config_tenant_theme_id;
      DROP INDEX IF EXISTS idx_app_credential_tenant_app_active;
      DROP INDEX IF EXISTS idx_app_webhook_tenant_event_active;
      DROP INDEX IF EXISTS idx_app_scope_tenant_scope;
      DROP INDEX IF EXISTS idx_app_scope_tenant_app_id;
      DROP INDEX IF EXISTS idx_tenant_tenant_id_id;
      DROP INDEX IF EXISTS idx_theme_metadata_tenant_id_id;
      DROP INDEX IF EXISTS idx_app_installation_tenant_id_id;
    `);
  }
}
