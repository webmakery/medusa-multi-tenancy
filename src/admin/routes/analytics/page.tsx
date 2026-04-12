import { defineRouteConfig } from '@medusajs/admin-sdk';
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
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.analytics.title')}</h1>
      <p>{t('admin.analytics.description')}</p>

      <fieldset style={{ marginBottom: '1rem' }}>
        <legend>{t('admin.analytics.filters.title')}</legend>
        <label style={{ marginRight: '0.75rem' }}>
          {t('admin.analytics.filters.from')}
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label style={{ marginRight: '0.75rem' }}>
          {t('admin.analytics.filters.to')}
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label>
          {t('admin.analytics.filters.limit')}
          <input
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(event) => setLimit(Math.min(100, Math.max(1, Number(event.target.value) || 10)))}
          />
        </label>
      </fieldset>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {!isLoading && error ? <p>{error}</p> : null}

      {!isLoading && !error ? (
        <>
          <h2>{t('admin.analytics.sections.timeseries')}</h2>
          {!timeseries.length ? <p>{t('admin.analytics.empty.timeseries')}</p> : null}
          {timeseries.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.analytics.columns.date')}</th>
                  <th>{t('admin.analytics.columns.gmv')}</th>
                  <th>{t('admin.analytics.columns.aov')}</th>
                  <th>{t('admin.analytics.columns.orders')}</th>
                  <th>{t('admin.analytics.columns.sessions')}</th>
                  <th>{t('admin.analytics.columns.checkoutStarted')}</th>
                  <th>{t('admin.analytics.columns.checkoutCompleted')}</th>
                  <th>{t('admin.analytics.columns.conversion')}</th>
                </tr>
              </thead>
              <tbody>
                {timeseries.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{formatCurrency(row.gmv_cents, row.currency_code)}</td>
                    <td>{formatCurrency(row.aov_cents, row.currency_code)}</td>
                    <td>{row.orders_count}</td>
                    <td>{row.sessions_count}</td>
                    <td>{row.checkout_started_count}</td>
                    <td>{row.checkout_completed_count}</td>
                    <td>{(row.conversion_proxy * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <h2>{t('admin.analytics.sections.topProducts')}</h2>
          {!topProducts.length ? <p>{t('admin.analytics.empty.topProducts')}</p> : null}
          {topProducts.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.analytics.columns.rank')}</th>
                  <th>{t('admin.analytics.columns.product')}</th>
                  <th>{t('admin.analytics.columns.quantity')}</th>
                  <th>{t('admin.analytics.columns.gmv')}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.product_id}>
                    <td>{product.rank}</td>
                    <td>{product.product_title || product.product_id}</td>
                    <td>{product.quantity}</td>
                    <td>{formatCurrency(product.gmv_cents, currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.analytics.menuLabel',
});

export default AnalyticsPage;
