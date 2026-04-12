import { defineRouteConfig } from '@medusajs/admin-sdk';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppWebhookDeliveryLog,
  getInstalledApps,
  getWebhookDeliveryLogs,
  installApp,
  InstalledApp,
  uninstallApp,
} from '../../lib/api/admin';

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
    const shouldUninstall = window.confirm(t('admin.apps.actions.confirmUninstall', { appName: app.app_name }));
    if (!shouldUninstall) return;

    setError('');
    setMessage('');
    try {
      const response = await uninstallApp(app.id);
      setMessage(response.message || t('admin.apps.messages.uninstalled'));
      await loadApps();
    } catch (err) {
      setError((err as Error).message || t('admin.apps.errors.uninstall'));
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 980 }}>
      <h1>{t('admin.apps.title')}</h1>
      <p>{t('admin.apps.description')}</p>
      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {error ? <p>{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <h2>{t('admin.apps.sections.install')}</h2>
      <form onSubmit={onInstall}>
        <label>
          {t('admin.apps.fields.name')}
          <input
            value={formState.app_name}
            onChange={(event) => setFormState((prev) => ({ ...prev, app_name: event.target.value }))}
            required
          />
        </label>
        <br />
        <label>
          {t('admin.apps.fields.identifier')}
          <input
            value={formState.app_identifier}
            onChange={(event) => setFormState((prev) => ({ ...prev, app_identifier: event.target.value }))}
            required
          />
        </label>
        <br />
        <label>
          {t('admin.apps.fields.url')}
          <input
            value={formState.app_url}
            onChange={(event) => setFormState((prev) => ({ ...prev, app_url: event.target.value }))}
            type="url"
          />
        </label>
        <fieldset>
          <legend>{t('admin.apps.sections.permissions')}</legend>
          {AVAILABLE_SCOPES.map((scope) => (
            <label key={scope} style={{ display: 'block' }}>
              <input checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} type="checkbox" />
              {scope}
            </label>
          ))}
        </fieldset>
        <label style={{ display: 'block', marginTop: '0.75rem' }}>
          <input checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} type="checkbox" />
          {t('admin.apps.consent')}
        </label>
        <button disabled={isSaving} type="submit">
          {isSaving ? t('admin.apps.actions.installing') : t('admin.apps.actions.install')}
        </button>
      </form>

      <h2>{t('admin.apps.sections.installed')}</h2>
      {!apps.length ? <p>{t('admin.apps.empty')}</p> : null}
      {apps.length ? (
        <ul>
          {apps.map((app) => (
            <li key={app.id}>
              <strong>{app.app_name}</strong> ({app.app_identifier}) - {app.scopes.join(', ') || t('admin.apps.none')}
              <button onClick={() => onUninstall(app)} style={{ marginLeft: '0.75rem' }} type="button">
                {t('admin.apps.actions.uninstall')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <h2>{t('admin.apps.sections.deliveryLogs')}</h2>
      {apps.length ? (
        <label>
          {t('admin.apps.fields.logsApp')}
          <select onChange={(event) => setSelectedAppIdForLogs(event.target.value)} value={selectedAppIdForLogs}>
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.app_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selectedApp ? <p>{t('admin.apps.logsFor', { appName: selectedApp.app_name })}</p> : null}
      {selectedApp && !logs.length ? <p>{t('admin.apps.noLogs')}</p> : null}
      {logs.length ? (
        <table>
          <thead>
            <tr>
              <th>{t('admin.apps.columns.event')}</th>
              <th>{t('admin.apps.columns.target')}</th>
              <th>{t('admin.apps.columns.status')}</th>
              <th>{t('admin.apps.columns.attempt')}</th>
              <th>{t('admin.apps.columns.response')}</th>
              <th>{t('admin.apps.columns.error')}</th>
              <th>{t('admin.apps.columns.deliveredAt')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.event_name}</td>
                <td>{log.target_url}</td>
                <td>{log.delivery_status}</td>
                <td>{log.attempt_number}</td>
                <td>{log.response_status || '-'}</td>
                <td>{log.error_message || '-'}</td>
                <td>{new Date(log.delivered_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.apps.menuLabel',
});

export default AppsPage;
