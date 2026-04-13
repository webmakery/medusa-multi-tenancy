import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Input, Label, Select, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  activatePlatformTenant,
  assignTenantAccess,
  getMyTenantAccess,
  listTenantAccess,
  TenantAccessRecord,
  TenantAccessSession,
} from '../../lib/api/admin';

const TenantAccessPage = () => {
  const { t } = useTranslation();
  const [session, setSession] = useState<TenantAccessSession | null>(null);
  const [records, setRecords] = useState<TenantAccessRecord[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignTenantId, setAssignTenantId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');

    try {
      const me = await getMyTenantAccess();
      setSession(me);

      if (me.is_platform_admin) {
        const listing = await listTenantAccess();
        setRecords(listing.entries || []);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      setError(err.message || t('admin.tenantAccess.errors.load'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const platformTenantOptions = records
    .filter((entry) => entry.tenant_id)
    .map((entry) => entry.tenant_id as string)
    .filter((value, index, all) => all.indexOf(value) === index);

  const onActivate = async (tenantId: string | null) => {
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await activatePlatformTenant(tenantId);
      setSession(updated);
      setMessage(t('admin.tenantAccess.messages.activated'));
    } catch (err: any) {
      setError(err.message || t('admin.tenantAccess.errors.activate'));
    } finally {
      setIsSaving(false);
    }
  };

  const onAssign = async () => {
    if (!assignEmail.trim() || !assignTenantId.trim()) {
      setError(t('admin.tenantAccess.errors.assignInput'));
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      await assignTenantAccess({ user_email: assignEmail.trim().toLowerCase(), tenant_id: assignTenantId.trim() });
      setMessage(t('admin.tenantAccess.messages.assigned'));
      setAssignEmail('');
      await load();
    } catch (err: any) {
      setError(err.message || t('admin.tenantAccess.errors.assign'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.tenantAccess.title')}</Heading>
        <Text size="small" className="mt-2 text-ui-fg-subtle">
          {t('admin.tenantAccess.description')}
        </Text>

        {isLoading ? <Text className="mt-4">{t('admin.shared.loading')}</Text> : null}

        {!isLoading && session ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.email')}</Text>
              <Text size="small">{session.email}</Text>
            </div>
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.role')}</Text>
              <Badge size="2xsmall" color={session.is_platform_admin ? 'blue' : 'green'}>
                {session.role}
              </Badge>
            </div>
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.assignedTenant')}</Text>
              <Text size="small">{session.assigned_tenant_id || '—'}</Text>
            </div>
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.activeTenant')}</Text>
              <Text size="small">{session.active_tenant_id || '—'}</Text>
            </div>
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.effectiveTenant')}</Text>
              <Text size="small">{session.effective_tenant_id || '—'}</Text>
            </div>
            <div>
              <Text size="small" weight="plus">{t('admin.tenantAccess.fields.autoProvisioned')}</Text>
              <Text size="small">{session.is_auto_provisioned ? t('admin.tenantAccess.values.yes') : t('admin.tenantAccess.values.no')}</Text>
            </div>
          </div>
        ) : null}
      </Container>

      {!isLoading && session?.is_platform_admin ? (
        <Container className="p-6">
          <Heading level="h2">{t('admin.tenantAccess.sections.platform')}</Heading>
          <div className="mt-4 max-w-md space-y-3">
            <Label htmlFor="platform_active_tenant">{t('admin.tenantAccess.fields.activeTenant')}</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <Select.Trigger id="platform_active_tenant" disabled={isSaving}>
                <Select.Value placeholder={t('admin.tenantAccess.values.adminMode')} />
              </Select.Trigger>
              <Select.Content>
                {platformTenantOptions.map((tenantId) => (
                  <Select.Item key={tenantId} value={tenantId}>
                    {tenantId}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" isLoading={isSaving} onClick={() => onActivate(selectedTenantId || null)}>
                {t('admin.tenantAccess.actions.activate')}
              </Button>
              <Button size="small" variant="transparent" isLoading={isSaving} onClick={() => onActivate(null)}>
                {t('admin.tenantAccess.actions.clear')}
              </Button>
            </div>
          </div>

          <div className="mt-6 max-w-md space-y-3">
            <Heading level="h3">{t('admin.tenantAccess.sections.assign')}</Heading>
            <div>
              <Label htmlFor="assign_email">{t('admin.tenantAccess.fields.assignEmail')}</Label>
              <Input id="assign_email" value={assignEmail} onChange={(event) => setAssignEmail(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="assign_tenant">{t('admin.tenantAccess.fields.assignTenant')}</Label>
              <Input id="assign_tenant" value={assignTenantId} onChange={(event) => setAssignTenantId(event.target.value)} />
            </div>
            <Button size="small" variant="secondary" isLoading={isSaving} onClick={onAssign}>
              {t('admin.tenantAccess.actions.assign')}
            </Button>
          </div>
        </Container>
      ) : null}

      {error ? <Text className="px-6 text-ui-fg-error">{error}</Text> : null}
      {message ? <Text className="px-6 text-ui-fg-interactive">{message}</Text> : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant access',
  rank: 21,
});

export default TenantAccessPage;
