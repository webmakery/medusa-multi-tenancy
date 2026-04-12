import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getTeamMembers, TeamMember } from '../../lib/api/admin';

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
    <div style={{ padding: '1.5rem' }}>
      <h1>{t('admin.teamMembers.title')}</h1>
      <p>{t('admin.teamMembers.description')}</p>

      {isLoading ? <p>{t('admin.shared.loading')}</p> : null}
      {!isLoading && error ? <p>{error}</p> : null}

      {!isLoading && !error && !members.length ? <p>{t('admin.teamMembers.empty')}</p> : null}

      {!isLoading && !error && members.length ? (
        <table>
          <thead>
            <tr>
              <th>{t('admin.teamMembers.columns.email')}</th>
              <th>{t('admin.teamMembers.columns.role')}</th>
              <th>{t('admin.teamMembers.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.user_email}</td>
                <td>{member.role}</td>
                <td>{member.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'admin.teamMembers.menuLabel',
});

export default TeamMembersPage;
