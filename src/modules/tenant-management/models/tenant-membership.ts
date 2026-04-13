import { model } from '@medusajs/framework/utils';

const TenantMembership = model.define('tenant_membership', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  user_email: model.text(),
  role: model.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  status: model.enum(['active', 'inactive']).default('active'),
});

export default TenantMembership;
