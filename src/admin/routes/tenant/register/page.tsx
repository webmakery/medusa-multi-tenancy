import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Input, Label } from '@medusajs/ui';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AuthPageShell from '../../../components/auth-page-shell';

const TenantRegisterPage = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name')?.toString().trim() || '';
    const email = formData.get('email')?.toString().trim() || '';
    const password = formData.get('password')?.toString().trim() || '';

    if (!name || !email || !password) {
      setErrorMessage(t('admin.tenantAuth.register.errors.required'));
      return;
    }

    setIsSubmitting(true);

    try {
      const signupResponse = await fetch('/store/tenants/signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        setErrorMessage(signupData?.message || t('admin.tenantAuth.register.errors.signup'));
        return;
      }

      const token = signupData?.verification?.token;

      if (!token) {
        setErrorMessage(t('admin.tenantAuth.register.errors.verify'));
        return;
      }

      const verifyResponse = await fetch('/store/tenants/verify-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setErrorMessage(verifyData?.message || t('admin.tenantAuth.register.errors.verify'));
        return;
      }

      window.location.assign('/app');
    } catch (error) {
      setErrorMessage(t('admin.tenantAuth.register.errors.network'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell title={t('admin.tenantAuth.register.title')} description={t('admin.tenantAuth.register.description')}>
      <form className="flex flex-col gap-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-name">{t('admin.tenantAuth.fields.name')}</Label>
          <Input id="tenant-register-name" name="name" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-email">{t('admin.tenantAuth.fields.email')}</Label>
          <Input id="tenant-register-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-password">{t('admin.tenantAuth.fields.password')}</Label>
          <Input
            id="tenant-register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {errorMessage ? (
          <div className="bg-ui-bg-base border-ui-border-base text-ui-fg-error rounded-lg border p-3 text-sm">{errorMessage}</div>
        ) : null}
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
