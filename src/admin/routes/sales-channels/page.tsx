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
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.salesChannels.title')}</h1>
      <p>{t('admin.salesChannels.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {error ? <p>{error}</p> : null}

      {!isLoading && channels.length ? (
        <ul>
          {channels.map((channel) => (
            <li key={channel.id}>
              <strong>{channel.name}</strong> — {channel.description} ({channel.is_enabled ? 'enabled' : 'disabled'})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.salesChannels.menuLabel',
});

export default SalesChannelsPage;
