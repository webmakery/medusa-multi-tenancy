import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BillingEntitlement, BillingUsage, getActiveTenantContext, getBillingOverview, updateBillingState } from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

const BillingPage = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [graceEndsAt, setGraceEndsAt] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<BillingEntitlement[]>([]);
  const [usage, setUsage] = useState<BillingUsage[]>([]);
  const [transitionLabels, setTransitionLabels] = useState<Record<string, string>>({});
  const [isMutating, setIsMutating] = useState(false);

  const load = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await getBillingOverview();
      const billing = response.billing;

      setStatus(billing?.account?.status || '');
      setPlanCode(billing?.account?.plan_code || '');
      setTrialEndsAt(billing?.account?.trial_ends_at || null);
      setGraceEndsAt(billing?.account?.grace_ends_at || null);
      setEntitlements(billing?.entitlements || []);
      setUsage(billing?.usage || []);
      setTransitionLabels(billing?.state_transitions || {});
    } catch (err: any) {
      setError(err.message || t('admin.billing.errors.load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onTransition = async (action: 'renew' | 'payment_failed' | 'payment_recovered' | 'expire_grace') => {
    setError('');

    try {
      const tenantContext = await getActiveTenantContext();
      const confirmationTenantId = tenantContext.active_tenant_id || tenantContext.memberships?.[0]?.tenant_id || '';

      if (!confirmationTenantId) {
        setError(t('admin.tenantContext.errors.noneSelected'));
        return;
      }

      const shouldProceed = window.confirm(
        t('admin.billing.actions.confirm', { action: t(`admin.billing.actions.${action}`), tenantId: confirmationTenantId })
      );

      if (!shouldProceed) {
        return;
      }

      setIsMutating(true);
      await updateBillingState(action, confirmationTenantId);
      await load();
    } catch (err: any) {
      setError(err.message || t('admin.billing.errors.update'));
    } finally {
      setIsMutating(false);
    }
  };

  const usageByMeter = usage.reduce<Record<string, number>>((acc, row) => {
    acc[row.meter_key] = row.used_quantity;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.billing.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">{t('admin.billing.description')}</Text>
        <TenantContextSwitcher />
      </Container>

      <Container className="p-6">
        {isLoading ? <Text>{t('admin.shared.loading')}</Text> : null}
        {!isLoading && error ? <Text className="text-ui-fg-error">{error}</Text> : null}
        {!isLoading && !error ? (
          <div className="flex flex-col gap-y-3">
            <div className="flex items-center gap-x-2">
              <Text>{t('admin.billing.fields.status')}</Text>
              <Badge color={status === 'active' ? 'green' : 'orange'} size="2xsmall">{status || '-'}</Badge>
            </div>
            <Text>{t('admin.billing.fields.plan', { plan: planCode || '-' })}</Text>
            {trialEndsAt ? <Text>{t('admin.billing.fields.trialEnds', { date: new Date(trialEndsAt).toLocaleString() })}</Text> : null}
            {graceEndsAt ? <Text>{t('admin.billing.fields.graceEnds', { date: new Date(graceEndsAt).toLocaleString() })}</Text> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="small" variant="secondary" isLoading={isMutating} onClick={() => onTransition('renew')}>
                {t('admin.billing.actions.renew')}
              </Button>
              <Button size="small" variant="secondary" isLoading={isMutating} onClick={() => onTransition('payment_failed')}>
                {t('admin.billing.actions.failPayment')}
              </Button>
              <Button size="small" variant="secondary" isLoading={isMutating} onClick={() => onTransition('payment_recovered')}>
                {t('admin.billing.actions.recoverPayment')}
              </Button>
              <Button size="small" variant="secondary" isLoading={isMutating} onClick={() => onTransition('expire_grace')}>
                {t('admin.billing.actions.expireGrace')}
              </Button>
            </div>
          </div>
        ) : null}
      </Container>

      <Container className="p-0 overflow-hidden">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t('admin.billing.columns.feature')}</Table.HeaderCell>
              <Table.HeaderCell>{t('admin.billing.columns.meter')}</Table.HeaderCell>
              <Table.HeaderCell>{t('admin.billing.columns.limit')}</Table.HeaderCell>
              <Table.HeaderCell>{t('admin.billing.columns.used')}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {entitlements.map((entitlement) => (
              <Table.Row key={entitlement.feature_key}>
                <Table.Cell>{entitlement.feature_key}</Table.Cell>
                <Table.Cell>{entitlement.meter_key || '-'}</Table.Cell>
                <Table.Cell>{entitlement.limit_value ?? t('admin.billing.unlimited')}</Table.Cell>
                <Table.Cell>{entitlement.meter_key ? usageByMeter[entitlement.meter_key] || 0 : '-'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.billing.transitions.title')}</Heading>
        <div className="mt-3 flex flex-col gap-y-2">
          {Object.entries(transitionLabels).map(([key, label]) => (
            <Text key={key}>{label}</Text>
          ))}
        </div>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Billing',
  rank: 30,
});

export default BillingPage;
