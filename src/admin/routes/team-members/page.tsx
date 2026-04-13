import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Label, Select, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveTenantMembership, getActiveTenantContext, getTeamMembers, switchActiveTenant, TeamMember } from '../../lib/api/admin';

const TeamMembersPage = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tenantMemberships, setTenantMemberships] = useState<ActiveTenantMembership[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [activeTenantId, setActiveTenantId] = useState('');
  const [tenantContextError, setTenantContextError] = useState('');
  const [tenantContextMessage, setTenantContextMessage] = useState('');
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveTenantContext()
      .then((response) => {
        setTenantMemberships(response.memberships || []);
        const currentTenant = response.active_tenant_id || response.memberships?.[0]?.tenant_id || '';
        setActiveTenantId(currentTenant);
        setSelectedTenantId(currentTenant);
      })
      .catch((err: Error) => setTenantContextError(err.message || t('admin.teamMembers.tenantSwitcher.errors.load')));

    getTeamMembers()
      .then((response) => setMembers(response.members))
      .catch((err: Error) => setError(err.message || t('admin.teamMembers.errors.load')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const onSwitchTenant = async () => {
    if (!selectedTenantId) {
      return;
    }

    setTenantContextError('');
    setTenantContextMessage('');
    setIsSwitchingTenant(true);

    try {
      const response = await switchActiveTenant(selectedTenantId);
      setActiveTenantId(response.active_tenant_id || selectedTenantId);
      setTenantContextMessage(t('admin.teamMembers.tenantSwitcher.success'));
    } catch (err: any) {
      setTenantContextError(err.message || t('admin.teamMembers.tenantSwitcher.errors.switch'));
    } finally {
      setIsSwitchingTenant(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.teamMembers.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.teamMembers.description')}
        </Text>
      </Container>

      <Container className="p-6">
        <div className="flex flex-col gap-y-2">
          <Heading level="h2">{t('admin.teamMembers.tenantSwitcher.title')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t('admin.teamMembers.tenantSwitcher.description')}
          </Text>
          <Text size="small">
            {activeTenantId
              ? t('admin.teamMembers.tenantSwitcher.current', { tenantId: activeTenantId })
              : t('admin.teamMembers.tenantSwitcher.none')}
          </Text>
        </div>
        {tenantMemberships.length > 1 ? (
          <div className="mt-4 flex flex-col gap-y-3 max-w-md">
            <Label htmlFor="tenant_switcher">{t('admin.teamMembers.tenantSwitcher.selectLabel')}</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <Select.Trigger id="tenant_switcher">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {tenantMemberships.map((membership) => (
                  <Select.Item key={membership.tenant_id} value={membership.tenant_id}>
                    {membership.tenant_id}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <div>
              <Button type="button" variant="secondary" size="small" onClick={onSwitchTenant} isLoading={isSwitchingTenant}>
                {t('admin.teamMembers.tenantSwitcher.action')}
              </Button>
            </div>
          </div>
        ) : null}
        {tenantContextMessage ? <Text className="mt-3 text-ui-fg-base">{tenantContextMessage}</Text> : null}
        {tenantContextError ? <Text className="mt-3 text-ui-fg-error">{tenantContextError}</Text> : null}
      </Container>

      <Container className="p-0 overflow-hidden">
        {isLoading ? (
          <Text className="p-6">{t('admin.shared.loading')}</Text>
        ) : null}

        {!isLoading && error ? <Text className="p-6 text-ui-fg-error">{error}</Text> : null}

        {!isLoading && !error && !members.length ? <Text className="p-6">{t('admin.teamMembers.empty')}</Text> : null}

        {!isLoading && !error && members.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('admin.teamMembers.columns.email')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.teamMembers.columns.role')}</Table.HeaderCell>
                <Table.HeaderCell>{t('admin.teamMembers.columns.status')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {members.map((member) => (
                <Table.Row key={member.id}>
                  <Table.Cell>{member.user_email}</Table.Cell>
                  <Table.Cell>{member.role}</Table.Cell>
                  <Table.Cell>
                    <Badge color={member.status === 'active' ? 'green' : 'orange'} size="2xsmall">
                      {member.status}
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
  label: 'Team members',
});

export default TeamMembersPage;
