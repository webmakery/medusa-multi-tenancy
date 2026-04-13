import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AuthPageShell from '../../../components/auth-page-shell';

const TenantLoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/auth/user/emailpass', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json().catch(() => ({})) : null;

      if (!response.ok) {
        const message =
          (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error ||
          t('admin.tenantAuth.errors.login');
        throw new Error(message);
      }

      window.location.assign('/app');
    } catch (err) {
      setError((err as Error).message || t('admin.tenantAuth.errors.login'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell title={t('admin.tenantAuth.login.title')} description={t('admin.tenantAuth.login.description')}>
      <form className="flex flex-col gap-y-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-login-email">{t('admin.tenantAuth.fields.email')}</Label>
          <Input
            id="tenant-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-login-password">{t('admin.tenantAuth.fields.password')}</Label>
          <Input
            id="tenant-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
        <Button type="submit" isLoading={isSubmitting}>
          {t('admin.tenantAuth.login.action')}
        </Button>
      </form>
    </AuthPageShell>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant login',
});

export default TenantLoginPage;
