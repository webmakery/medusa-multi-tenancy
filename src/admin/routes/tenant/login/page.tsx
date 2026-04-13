import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Input, Label } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import AuthPageShell from '../../../components/auth-page-shell';

const TenantLoginPage = () => {
  const { t } = useTranslation();

  return (
    <AuthPageShell title={t('admin.tenantAuth.login.title')} description={t('admin.tenantAuth.login.description')}>
      <form className="flex flex-col gap-y-4" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-login-email">{t('admin.tenantAuth.fields.email')}</Label>
          <Input id="tenant-login-email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-login-password">{t('admin.tenantAuth.fields.password')}</Label>
          <Input id="tenant-login-password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit">{t('admin.tenantAuth.login.action')}</Button>
      </form>
    </AuthPageShell>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant login',
});

export default TenantLoginPage;
