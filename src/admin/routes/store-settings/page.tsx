import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getStoreSettings, StoreSettings, updateStoreSettings } from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

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
  const [isSaving, setIsSaving] = useState(false);
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
    setIsSaving(true);

    try {
      const response = await updateStoreSettings(settings);
      setSettings(response.settings);
      setMessage(response.message || t('admin.storeSettings.success.saved'));
    } catch (err) {
      setError((err as Error).message || t('admin.storeSettings.errors.save'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.storeSettings.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.storeSettings.description')}
        </Text>
        <TenantContextSwitcher />
      </Container>

      <Container className="p-6 max-w-2xl">
        {isLoading ? <Text>{t('admin.shared.loading')}</Text> : null}
        {!isLoading && error ? <Text className="text-ui-fg-error">{error}</Text> : null}

        {!isLoading && !error ? (
          <form onSubmit={onSave} className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="store_name">{t('admin.storeSettings.fields.storeName')}</Label>
              <Input
                id="store_name"
                value={settings.store_name}
                onChange={(event) => setSettings((prev) => ({ ...prev, store_name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="support_email">{t('admin.storeSettings.fields.supportEmail')}</Label>
              <Input
                id="support_email"
                type="email"
                value={settings.support_email}
                onChange={(event) => setSettings((prev) => ({ ...prev, support_email: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="default_currency_code">{t('admin.storeSettings.fields.defaultCurrency')}</Label>
              <Input
                id="default_currency_code"
                value={settings.default_currency_code}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, default_currency_code: event.target.value.toLowerCase() }))
                }
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="timezone">{t('admin.storeSettings.fields.timezone')}</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
              />
            </div>
            <div className="flex items-center gap-x-3">
              <Button type="submit" isLoading={isSaving}>
                {t('admin.storeSettings.actions.save')}
              </Button>
              {message ? <Text className="text-ui-fg-interactive">{message}</Text> : null}
            </div>
          </form>
        ) : null}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Settings',
  rank: 40,
});

export default StoreSettingsPage;
