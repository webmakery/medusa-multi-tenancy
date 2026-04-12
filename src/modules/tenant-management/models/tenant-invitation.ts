import { model } from '@medusajs/framework/utils';

const TenantInvitation = model.define('tenant_invitation', {
  id: model.id().primaryKey(),
  tenant_id: model.text(),
  email: model.text(),
  role: model.enum(['owner', 'admin', 'staff']).default('staff'),
  invitation_token: model.text(),
  status: model.enum(['pending', 'accepted', 'revoked']).default('pending'),
  invited_by: model.text().nullable(),
  accepted_at: model.dateTime().nullable(),
  expires_at: model.dateTime(),
});

export default TenantInvitation;
