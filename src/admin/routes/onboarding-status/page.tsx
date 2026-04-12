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
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.onboarding.title')}</h1>
      <p>{t('admin.onboarding.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {error ? <p>{error}</p> : null}

      {!isLoading ? (
        <>
          <p>
            {t('admin.onboarding.progress', {
              completed: completedCount,
              total: checklist.length,
            })}
          </p>
          <ul>
            {checklist.map((item) => (
              <li key={item.key}>
                {item.is_completed ? '✅' : '⬜'} {item.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.onboarding.menuLabel',
});

export default OnboardingStatusPage;
