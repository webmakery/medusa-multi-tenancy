import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AuthPageShell from '../../../components/auth-page-shell';

const TenantRegisterPage = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/store/tenants/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
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
          t('admin.tenantAuth.errors.register');
        throw new Error(message);
      }

      setMessage(t('admin.tenantAuth.success.register'));
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError((err as Error).message || t('admin.tenantAuth.errors.register'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell title={t('admin.tenantAuth.register.title')} description={t('admin.tenantAuth.register.description')}>
      <form className="flex flex-col gap-y-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-name">{t('admin.tenantAuth.fields.name')}</Label>
          <Input
            id="tenant-register-name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-email">{t('admin.tenantAuth.fields.email')}</Label>
          <Input
            id="tenant-register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-password">{t('admin.tenantAuth.fields.password')}</Label>
          <Input
            id="tenant-register-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
        {message ? <Text className="text-ui-fg-interactive">{message}</Text> : null}
        <Button type="submit" isLoading={isSubmitting}>
          {t('admin.tenantAuth.register.action')}
        </Button>
      </form>
    </AuthPageShell>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant register',
});

export default TenantRegisterPage;
