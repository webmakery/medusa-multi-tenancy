import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getSalesChannels, SalesChannel } from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

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
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.salesChannels.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.salesChannels.description')}
        </Text>
        <TenantContextSwitcher />
      </Container>

      <Container className="p-0 overflow-hidden">
        {isLoading ? <Text className="p-6">{t('admin.shared.loading')}</Text> : null}
        {!isLoading && error ? <Text className="p-6 text-ui-fg-error">{error}</Text> : null}
        {!isLoading && !error && !channels.length ? <Text className="p-6">{t('admin.salesChannels.empty')}</Text> : null}

        {!isLoading && !error && channels.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('admin.salesChannels.title')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.salesChannels.description')}</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {channels.map((channel) => (
                <Table.Row key={channel.id}>
                  <Table.Cell>{channel.name}</Table.Cell>
                  <Table.Cell>{channel.description || '-'}</Table.Cell>
                  <Table.Cell>
                    <Badge color={channel.is_enabled ? 'green' : 'grey'} size="2xsmall">
                      {channel.is_enabled
                        ? t('admin.salesChannels.status.enabled')
                        : t('admin.salesChannels.status.disabled')}
                    </Badge>
                  </Table.Cell>
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
});

export default SalesChannelsPage;
