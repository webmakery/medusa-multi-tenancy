import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Input, Label, Table, Text } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AnalyticsTimeseriesPoint,
  AnalyticsTopProduct,
  getAnalyticsTimeseries,
  getAnalyticsTopProducts,
} from '../../lib/api/admin';

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const formatCurrency = (amountCents: number, currencyCode?: string | null) => {
  const normalizedCode = (currencyCode || 'usd').toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCode,
    }).format(amountCents / 100);
  } catch {
    return `${normalizedCode} ${(amountCents / 100).toFixed(2)}`;
  }
};

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [limit, setLimit] = useState(10);

  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const currencyCode = useMemo(
    () => timeseries.find((row) => !!row.currency_code)?.currency_code || 'usd',
    [timeseries]
  );

  useEffect(() => {
    setIsLoading(true);
    setError('');

    Promise.all([
      getAnalyticsTimeseries({ from: fromDate, to: toDate }),
      getAnalyticsTopProducts({ from: fromDate, to: toDate, limit }),
    ])
      .then(([seriesResponse, topProductsResponse]) => {
        setTimeseries(seriesResponse.data || []);
        setTopProducts(topProductsResponse.data || []);
      })
      .catch((err: Error) => setError(err.message || t('admin.analytics.errors.load')))
      .finally(() => setIsLoading(false));
  }, [fromDate, toDate, limit, t]);

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.analytics.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.analytics.description')}
        </Text>
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.analytics.filters.title')}</Heading>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="analytics_from">{t('admin.analytics.filters.from')}</Label>
            <Input id="analytics_from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="analytics_to">{t('admin.analytics.filters.to')}</Label>
            <Input id="analytics_to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="analytics_limit">{t('admin.analytics.filters.limit')}</Label>
            <Input
              id="analytics_limit"
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Math.min(100, Math.max(1, Number(event.target.value) || 10)))}
            />
          </div>
        </div>
      </Container>

      {isLoading ? <Text>{t('admin.shared.loading')}</Text> : null}
      {!isLoading && error ? <Text className="text-ui-fg-error">{error}</Text> : null}

      {!isLoading && !error ? (
        <>
          <Container className="p-0 overflow-hidden">
            <div className="p-6 border-b border-ui-border-base">
              <Heading level="h2">{t('admin.analytics.sections.timeseries')}</Heading>
            </div>
            {!timeseries.length ? <Text className="p-6">{t('admin.analytics.empty.timeseries')}</Text> : null}
            {timeseries.length ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>{t('admin.analytics.columns.date')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.gmv')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.aov')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.orders')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.sessions')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.checkoutStarted')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.checkoutCompleted')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.conversion')}</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {timeseries.map((row) => (
                    <Table.Row key={row.date}>
                      <Table.Cell>{row.date}</Table.Cell>
                      <Table.Cell>{formatCurrency(row.gmv_cents, row.currency_code)}</Table.Cell>
                      <Table.Cell>{formatCurrency(row.aov_cents, row.currency_code)}</Table.Cell>
                      <Table.Cell>{row.orders_count}</Table.Cell>
                      <Table.Cell>{row.sessions_count}</Table.Cell>
                      <Table.Cell>{row.checkout_started_count}</Table.Cell>
                      <Table.Cell>{row.checkout_completed_count}</Table.Cell>
                      <Table.Cell>{(row.conversion_proxy * 100).toFixed(1)}%</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : null}
          </Container>

          <Container className="p-0 overflow-hidden">
            <div className="p-6 border-b border-ui-border-base">
              <Heading level="h2">{t('admin.analytics.sections.topProducts')}</Heading>
            </div>
            {!topProducts.length ? <Text className="p-6">{t('admin.analytics.empty.topProducts')}</Text> : null}
            {topProducts.length ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>{t('admin.analytics.columns.rank')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.product')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.quantity')}</Table.HeaderCell>
                    <Table.HeaderCell>{t('admin.analytics.columns.gmv')}</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {topProducts.map((product) => (
                    <Table.Row key={product.product_id}>
                      <Table.Cell>{product.rank}</Table.Cell>
                      <Table.Cell>{product.product_title || product.product_id}</Table.Cell>
                      <Table.Cell>{product.quantity}</Table.Cell>
                      <Table.Cell>{formatCurrency(product.gmv_cents, currencyCode)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : null}
          </Container>
        </>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Analytics',
});

export default AnalyticsPage;
