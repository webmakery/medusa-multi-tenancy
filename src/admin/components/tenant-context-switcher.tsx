import { Badge, Button, Label, Select, Text } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveTenantMembership, getActiveTenantContext, switchActiveTenant } from '../lib/api/admin';

const TenantContextSwitcher = () => {
  const { t } = useTranslation();
  const [memberships, setMemberships] = useState<ActiveTenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setIsLoading(true);
    getActiveTenantContext()
      .then((response) => {
        const currentTenant = response.active_tenant_id || response.memberships?.[0]?.tenant_id || '';
        setMemberships(response.memberships || []);
        setActiveTenantId(currentTenant);
        setSelectedTenantId(currentTenant);
      })
      .catch((err: Error) => setError(err.message || t('admin.tenantContext.errors.load')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.tenant_id === activeTenantId),
    [memberships, activeTenantId]
  );

  const onSwitch = async () => {
    if (!selectedTenantId || selectedTenantId === activeTenantId) {
      return;
    }

    setIsSwitching(true);
    setError('');
    setMessage('');

    try {
      const response = await switchActiveTenant(selectedTenantId);
      const nextTenantId = response.active_tenant_id || selectedTenantId;
      setActiveTenantId(nextTenantId);
      setMessage(t('admin.tenantContext.messages.updated'));
      window.location.reload();
    } catch (err: any) {
      setError(err.message || t('admin.tenantContext.errors.switch'));
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="mt-4 rounded-rounded border border-ui-border-base p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="small" weight="plus">
          {t('admin.tenantContext.current')}
        </Text>
        <Badge size="2xsmall" color="blue">
          {activeTenantId || t('admin.tenantContext.none')}
        </Badge>
        {activeMembership ? (
          <Badge size="2xsmall" color="grey">
            {activeMembership.role}
          </Badge>
        ) : null}
      </div>

      {memberships.length > 1 ? (
        <div className="mt-3 flex max-w-md flex-col gap-y-3">
          <Label htmlFor="global_tenant_switcher">{t('admin.tenantContext.selectLabel')}</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <Select.Trigger id="global_tenant_switcher" disabled={isLoading || isSwitching}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {memberships.map((membership) => (
                <Select.Item key={membership.tenant_id} value={membership.tenant_id}>
                  {membership.tenant_id}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <div>
            <Button size="small" variant="secondary" isLoading={isSwitching} onClick={onSwitch}>
              {t('admin.tenantContext.switchAction')}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <Text className="mt-2 text-ui-fg-error">{error}</Text> : null}
      {message ? <Text className="mt-2 text-ui-fg-interactive">{message}</Text> : null}
    </div>
  );
};

export default TenantContextSwitcher;
