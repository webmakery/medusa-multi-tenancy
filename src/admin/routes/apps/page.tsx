import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
} from '@medusajs/ui';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppWebhookDeliveryLog,
  getActiveTenantContext,
  getInstalledApps,
  getWebhookDeliveryLogs,
  installApp,
  InstalledApp,
  uninstallApp,
} from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

const AVAILABLE_SCOPES = ['orders.read', 'orders.write', 'products.read', 'products.write', 'customers.read'];

const AppsPage = () => {
  const { t } = useTranslation();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedAppIdForLogs, setSelectedAppIdForLogs] = useState('');
  const [logs, setLogs] = useState<AppWebhookDeliveryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({
    app_name: '',
    app_identifier: '',
    app_url: '',
  });

  const selectedApp = useMemo(() => apps.find((app) => app.id === selectedAppIdForLogs) || null, [apps, selectedAppIdForLogs]);

  const loadApps = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getInstalledApps();
      setApps(response.apps || []);
      setSelectedAppIdForLogs((current) => current || response.apps?.[0]?.id || '');
    } catch (err) {
      setError((err as Error).message || t('admin.apps.errors.load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (!selectedAppIdForLogs) {
      setLogs([]);
      return;
    }

    getWebhookDeliveryLogs(selectedAppIdForLogs, 30)
      .then((response) => setLogs(response.logs || []))
      .catch((err: Error) => setError(err.message || t('admin.apps.errors.loadLogs')));
  }, [selectedAppIdForLogs, t]);

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );
  };

  const onInstall = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!consentChecked) {
      setError(t('admin.apps.errors.consentRequired'));
      return;
    }

    if (!selectedScopes.length) {
      setError(t('admin.apps.errors.scopeRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await installApp({
        app_name: formState.app_name.trim(),
        app_identifier: formState.app_identifier.trim(),
        app_url: formState.app_url.trim() || undefined,
        scopes: selectedScopes,
      });
      setMessage(response.message || t('admin.apps.messages.installed'));
      setFormState({ app_name: '', app_identifier: '', app_url: '' });
      setSelectedScopes([]);
      setConsentChecked(false);
      await loadApps();
    } catch (err) {
      setError((err as Error).message || t('admin.apps.errors.install'));
    } finally {
      setIsSaving(false);
    }
  };

  const onUninstall = async (app: InstalledApp) => {
    const tenantContext = await getActiveTenantContext();
    const confirmationTenantId = tenantContext.active_tenant_id || tenantContext.memberships?.[0]?.tenant_id || '';

    if (!confirmationTenantId) {
      setError(t('admin.tenantContext.errors.noneSelected'));
      return;
    }

    const shouldUninstall = window.confirm(
      t('admin.apps.actions.confirmUninstall', { appName: app.app_name, tenantId: confirmationTenantId })
    );

    if (!shouldUninstall) return;

    setError('');
    setMessage('');
    try {
      const response = await uninstallApp(app.id, confirmationTenantId);
      setMessage(response.message || t('admin.apps.messages.uninstalled'));
      await loadApps();
    } catch (err) {
      setError((err as Error).message || t('admin.apps.errors.uninstall'));
    }
  };

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.apps.title')}</Heading>
        <Text size="small" className="mt-2 text-ui-fg-subtle">
          {t('admin.apps.description')}
        </Text>
        <TenantContextSwitcher />
        {isLoading ? <Text className="mt-4">{t('admin.shared.loading')}</Text> : null}
        {error ? <Text className="mt-2 text-ui-fg-error">{error}</Text> : null}
        {message ? <Text className="mt-2 text-ui-fg-interactive">{message}</Text> : null}
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.apps.sections.install')}</Heading>
        <form onSubmit={onInstall} className="mt-4 flex flex-col gap-y-4 max-w-2xl">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="app_name">{t('admin.apps.fields.name')}</Label>
            <Input
              id="app_name"
              value={formState.app_name}
              onChange={(event) => setFormState((prev) => ({ ...prev, app_name: event.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="app_identifier">{t('admin.apps.fields.identifier')}</Label>
            <Input
              id="app_identifier"
              value={formState.app_identifier}
              onChange={(event) => setFormState((prev) => ({ ...prev, app_identifier: event.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="app_url">{t('admin.apps.fields.url')}</Label>
            <Input
              id="app_url"
              value={formState.app_url}
              onChange={(event) => setFormState((prev) => ({ ...prev, app_url: event.target.value }))}
              type="url"
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Text size="small" weight="plus">
              {t('admin.apps.sections.permissions')}
            </Text>
            <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <Label key={scope} className="flex items-center gap-x-2">
                  <Checkbox
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                    aria-label={scope}
                  />
                  {scope}
                </Label>
              ))}
            </div>
          </div>
          <Label className="flex items-center gap-x-2">
            <Checkbox checked={consentChecked} onCheckedChange={(value) => setConsentChecked(Boolean(value))} />
            {t('admin.apps.consent')}
          </Label>
          <div>
            <Button disabled={isSaving} type="submit" isLoading={isSaving}>
              {isSaving ? t('admin.apps.actions.installing') : t('admin.apps.actions.install')}
            </Button>
          </div>
        </form>
      </Container>

      <Container className="p-0 overflow-hidden">
        <div className="p-6 border-b border-ui-border-base">
          <Heading level="h2">{t('admin.apps.sections.installed')}</Heading>
        </div>
        {!apps.length ? <Text className="p-6">{t('admin.apps.empty')}</Text> : null}
        {apps.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('admin.apps.fields.name')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.fields.identifier')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.sections.permissions')}</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {apps.map((app) => (
                <Table.Row key={app.id}>
                  <Table.Cell>{app.app_name}</Table.Cell>
                  <Table.Cell>{app.app_identifier}</Table.Cell>
                  <Table.Cell className="max-w-md">
                    <Text size="small">{app.scopes.join(', ') || t('admin.apps.none')}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button variant="secondary" size="small" onClick={() => onUninstall(app)} type="button">
                      {t('admin.apps.actions.uninstall')}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : null}
      </Container>

      <Container className="p-0 overflow-hidden">
        <div className="p-6 border-b border-ui-border-base flex flex-col gap-y-2">
          <Heading level="h2">{t('admin.apps.sections.deliveryLogs')}</Heading>
          {apps.length ? (
            <div className="flex flex-col gap-y-2 max-w-xs">
              <Label htmlFor="logs_app">{t('admin.apps.fields.logsApp')}</Label>
              <Select value={selectedAppIdForLogs} onValueChange={setSelectedAppIdForLogs}>
                <Select.Trigger id="logs_app">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {apps.map((app) => (
                    <Select.Item key={app.id} value={app.id}>
                      {app.app_name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          ) : null}
          {selectedApp ? <Text size="small">{t('admin.apps.logsFor', { appName: selectedApp.app_name })}</Text> : null}
        </div>
        {selectedApp && !logs.length ? <Text className="p-6">{t('admin.apps.noLogs')}</Text> : null}
        {logs.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('admin.apps.columns.event')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.target')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.status')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.attempt')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.response')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.error')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.apps.columns.deliveredAt')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {logs.map((log) => (
                <Table.Row key={log.id}>
                  <Table.Cell>{log.event_name}</Table.Cell>
                  <Table.Cell>{log.target_url}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={log.delivery_status === 'delivered' ? 'green' : log.delivery_status === 'failed' ? 'red' : 'orange'}
                      size="2xsmall"
                    >
                      {log.delivery_status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{log.attempt_number}</Table.Cell>
                  <Table.Cell>{log.response_status || '-'}</Table.Cell>
                  <Table.Cell>
                    <Text size="small">{log.error_message || '-'}</Text>
                  </Table.Cell>
                  <Table.Cell>{new Date(log.delivered_at).toLocaleString()}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : null}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Apps',
});

export default AppsPage;
