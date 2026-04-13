import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getOnboardingChecklist, OnboardingChecklistItem, OnboardingDiagnostic, OnboardingFunnel } from '../../lib/api/admin';
import TenantContextSwitcher from '../../components/tenant-context-switcher';

const OnboardingStatusPage = () => {
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState<OnboardingChecklistItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [funnel, setFunnel] = useState<OnboardingFunnel | null>(null);
  const [diagnostics, setDiagnostics] = useState<OnboardingDiagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOnboardingChecklist()
      .then((response) => {
        setChecklist(response.checklist);
        setCompletedCount(response.completed);
        setFunnel(response.funnel || null);
        setDiagnostics(response.diagnostics || []);
      })
      .catch((err: Error) => setError(err.message || t('admin.onboarding.errors.load')))
      .finally(() => setIsLoading(false));
  }, [t]);

  return (
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.onboarding.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.onboarding.description')}
        </Text>
        <TenantContextSwitcher />
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.onboarding.sections.checklist')}</Heading>
        {isLoading ? <Text>{t('admin.shared.loading')}</Text> : null}
        {!isLoading && error ? <Text className="text-ui-fg-error">{error}</Text> : null}

        {!isLoading && !error ? (
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between">
              <Text>
                {t('admin.onboarding.progress', {
                  completed: completedCount,
                  total: checklist.length,
                })}
              </Text>
              <Badge color="blue" size="2xsmall">
                {checklist.length ? `${Math.round((completedCount / checklist.length) * 100)}%` : '0%'}
              </Badge>
            </div>

            {checklist.length ? (
              <div className="flex flex-col gap-y-2">
                {checklist.map((item) => (
                  <Container key={item.key} className="p-4">
                    <div className="flex items-start justify-between gap-x-4">
                      <div className="flex flex-col gap-y-1">
                        <Text>{t(`admin.onboarding.items.${item.key}`, item.label || item.key)}</Text>
                        {!item.is_completed && item.hint ? (
                          <Text size="small" className="text-ui-fg-subtle">
                            {item.hint}
                          </Text>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-x-2">
                        <Badge color={item.is_completed ? 'green' : 'orange'} size="2xsmall">
                          {item.is_completed ? 'Completed' : 'Action needed'}
                        </Badge>
                        {!item.is_completed && item.action_path ? (
                          <Button size="small" variant="secondary" asChild>
                            <a href={item.action_path}>{item.action_label || t('admin.onboarding.actions.open')}</a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Container>
                ))}
              </div>
            ) : (
              <Text>{t('admin.shared.noData')}</Text>
            )}
          </div>
        ) : null}
      </Container>

      <Container className="p-0 overflow-hidden">
        <div className="p-6 border-b border-ui-border-base">
          <Heading level="h2">{t('admin.onboarding.sections.funnel')}</Heading>
        </div>
        {funnel ? (
          <Table>
            <Table.Body>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.signup')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.signup_completed ? 'green' : 'orange'} size="2xsmall">
                    {funnel.signup_completed ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.verify')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.email_verified ? 'green' : 'orange'} size="2xsmall">
                    {funnel.email_verified ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.tenantCreated')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.tenant_created ? 'green' : 'orange'} size="2xsmall">
                    {funnel.tenant_created ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.ownerAssigned')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.owner_assigned ? 'green' : 'orange'} size="2xsmall">
                    {funnel.owner_assigned ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.firstProject')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.first_project_setup_completed ? 'green' : 'orange'} size="2xsmall">
                    {funnel.first_project_setup_completed ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.invite')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.team_invited ? 'green' : 'orange'} size="2xsmall">
                    {funnel.team_invited ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>{t('admin.onboarding.funnel.value')}</Table.Cell>
                <Table.Cell>
                  <Badge color={funnel.first_value_action_completed ? 'green' : 'orange'} size="2xsmall">
                    {funnel.first_value_action_completed ? 'Completed' : 'Pending'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        ) : (
          <Text className="p-6">{t('admin.shared.noData')}</Text>
        )}
        {funnel ? (
          <Text size="small" className="p-6 pt-0 text-ui-fg-subtle">
            {funnel.first_value_at
              ? t('admin.onboarding.funnel.firstValueAt', {
                  date: new Date(funnel.first_value_at).toLocaleString(),
                })
              : t('admin.onboarding.funnel.missingValue')}
          </Text>
        ) : null}
        {funnel?.drop_off_alerts?.length ? (
          <div className="px-6 pb-6">
            {funnel.drop_off_alerts.map((alert) => (
              <div key={alert.key} className="mt-2">
                <Badge color="orange" size="2xsmall">
                  Action needed
                </Badge>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  {alert.detail}
                </Text>
              </div>
            ))}
          </div>
        ) : null}
      </Container>

      <Container className="p-0 overflow-hidden">
        <div className="p-6 border-b border-ui-border-base">
          <Heading level="h2">{t('admin.onboarding.sections.diagnostics')}</Heading>
        </div>
        {diagnostics.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Check</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Details</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {diagnostics.map((diagnostic) => (
                <Table.Row key={diagnostic.key}>
                  <Table.Cell>{diagnostic.label}</Table.Cell>
                  <Table.Cell>
                    <Badge color={diagnostic.status === 'ok' ? 'green' : 'red'} size="2xsmall">
                      {diagnostic.status === 'ok' ? t('admin.onboarding.diagnostics.ok') : t('admin.onboarding.diagnostics.blocked')}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{diagnostic.detail}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Text className="p-6">{t('admin.shared.noData')}</Text>
        )}
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.onboarding.sections.churn')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.onboarding.churn.description')}
        </Text>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Overview',
  rank: 10,
});

export default OnboardingStatusPage;
