import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Container, Heading, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getOnboardingChecklist, OnboardingChecklistItem } from '../../lib/api/admin';

const OnboardingStatusPage = () => {
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState<OnboardingChecklistItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOnboardingChecklist()
      .then((response) => {
        setChecklist(response.checklist);
        setCompletedCount(response.completed);
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
      </Container>

      <Container className="p-6">
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
                  <Container key={item.key} className="p-4 flex items-center justify-between">
                    <Text>{t(`admin.onboarding.items.${item.key}`, item.label || item.key)}</Text>
                    <Badge color={item.is_completed ? 'green' : 'grey'} size="2xsmall">
                      {item.is_completed ? 'Completed' : 'Pending'}
                    </Badge>
                  </Container>
                ))}
              </div>
            ) : (
              <Text>{t('admin.shared.noData')}</Text>
            )}
          </div>
        ) : null}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Onboarding',
});

export default OnboardingStatusPage;
