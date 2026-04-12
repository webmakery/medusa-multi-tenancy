import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getSalesChannels, SalesChannel } from '../../lib/api/admin';

const SalesChannelsPage = () => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSalesChannels()
      .then((response) => setChannels(response.sales_channels))
      .catch((err: Error) => setError(err.message || t('admin.salesChannels.errors.load')))
      .finally(() => setIsLoading(false));
  }, [t]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.salesChannels.title')}</h1>
      <p>{t('admin.salesChannels.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {!isLoading && error ? <p>{error}</p> : null}

      {!isLoading && !error && !channels.length ? <p>{t('admin.salesChannels.empty')}</p> : null}

      {!isLoading && !error && channels.length ? (
        <ul>
          {channels.map((channel) => (
            <li key={channel.id}>
              <strong>{channel.name}</strong> — {channel.description}{' '}
              ({channel.is_enabled ? t('admin.salesChannels.status.enabled') : t('admin.salesChannels.status.disabled')})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Sales channels',
});

export default SalesChannelsPage;
