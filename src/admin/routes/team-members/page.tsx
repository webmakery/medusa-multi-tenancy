import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getTeamMembers, TeamMember } from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

const TeamMembersPage = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTeamMembers()
      .then((response) => setMembers(response.members))
      .catch((err: Error) => setError(err.message || t('admin.teamMembers.errors.load')))
      .finally(() => setIsLoading(false));
  }, [t]);

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.teamMembers.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.teamMembers.description')}
        </Text>
        <TenantContextSwitcher />
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
  label: 'Users',
  rank: 20,
});

export default TeamMembersPage;
