import { defineRouteConfig } from '@medusajs/admin-sdk';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getStoreSettings, StoreSettings, updateStoreSettings } from '../../lib/api/admin';

const defaultState: StoreSettings = {
  store_name: '',
  support_email: '',
  default_currency_code: 'usd',
  timezone: 'UTC',
};

const StoreSettingsPage = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<StoreSettings>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getStoreSettings()
      .then((response) => {
        setSettings(response.settings);
      })
      .catch((err: Error) => {
        setError(err.message || t('admin.storeSettings.errors.load'));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();

    setError('');
    setMessage('');

    try {
      const response = await updateStoreSettings(settings);
      setSettings(response.settings);
      setMessage(response.message || t('admin.storeSettings.success.saved'));
    } catch (err) {
      setError((err as Error).message || t('admin.storeSettings.errors.save'));
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 700 }}>
      <h1>{t('admin.storeSettings.title')}</h1>
      <p>{t('admin.storeSettings.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}

      {!isLoading && error ? <p>{error}</p> : null}

      {!isLoading && !error ? (
        <form onSubmit={onSave}>
          <label>
            {t('admin.storeSettings.fields.storeName')}
            <input
              value={settings.store_name}
              onChange={(event) => setSettings((prev) => ({ ...prev, store_name: event.target.value }))}
            />
          </label>
          <br />
          <label>
            {t('admin.storeSettings.fields.supportEmail')}
            <input
              type="email"
              value={settings.support_email}
              onChange={(event) => setSettings((prev) => ({ ...prev, support_email: event.target.value }))}
            />
          </label>
          <br />
          <label>
            {t('admin.storeSettings.fields.defaultCurrency')}
            <input
              value={settings.default_currency_code}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, default_currency_code: event.target.value.toLowerCase() }))
              }
            />
          </label>
          <br />
          <label>
            {t('admin.storeSettings.fields.timezone')}
            <input
              value={settings.timezone}
              onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
            />
          </label>
          <br />
          <button type="submit">{t('admin.storeSettings.actions.save')}</button>
        </form>
      ) : null}

      {message ? <p>{message}</p> : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Store settings',
});

export default StoreSettingsPage;
