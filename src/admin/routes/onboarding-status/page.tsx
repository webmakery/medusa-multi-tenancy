import { defineRouteConfig } from '@medusajs/admin-sdk';
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
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.onboarding.title')}</h1>
      <p>{t('admin.onboarding.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {!isLoading && error ? <p>{error}</p> : null}

      {!isLoading && !error ? (
        <>
          <p>
            {t('admin.onboarding.progress', {
              completed: completedCount,
              total: checklist.length,
            })}
          </p>

          {checklist.length ? (
            <ul>
              {checklist.map((item) => (
                <li key={item.key}>
                  {item.is_completed ? '✅' : '⬜'} {t(`admin.onboarding.items.${item.key}`, item.label || item.key)}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('admin.shared.noData')}</p>
          )}
        </>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.onboarding.menuLabel',
});

export default OnboardingStatusPage;
