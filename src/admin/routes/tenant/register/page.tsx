import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Input, Label } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import AuthPageShell from '../../../components/auth-page-shell';

const TenantRegisterPage = () => {
  const { t } = useTranslation();

  return (
    <AuthPageShell title={t('admin.tenantAuth.register.title')} description={t('admin.tenantAuth.register.description')}>
      <form className="flex flex-col gap-y-4" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-name">{t('admin.tenantAuth.fields.name')}</Label>
          <Input id="tenant-register-name" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-email">{t('admin.tenantAuth.fields.email')}</Label>
          <Input id="tenant-register-email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="tenant-register-password">{t('admin.tenantAuth.fields.password')}</Label>
          <Input id="tenant-register-password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit">{t('admin.tenantAuth.register.action')}</Button>
      </form>
    </AuthPageShell>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant register',
});

export default TenantRegisterPage;
