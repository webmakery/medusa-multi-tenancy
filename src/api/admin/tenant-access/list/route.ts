import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from 'knex';

import { resolveTenantUserAccess } from '../../_shared/tenant-user-access';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const access = await resolveTenantUserAccess(req);

  if (!access.actorEmail) {
    return res.status(401).json({ message: 'Authenticated user email is required.' });
  }

  if (!access.isPlatformAdmin) {
    return res.status(403).json({ message: 'Only platform admins can list tenant access records.' });
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  const entries = await knex('tenant_user_access')
    .select(
      'id',
      'user_id',
      'user_email',
      'tenant_id',
      'role',
      'is_platform_admin',
      'active_tenant_id',
      'is_auto_provisioned',
      'created_at',
      'updated_at'
    )
    .orderBy('created_at', 'desc');

  return res.status(200).json({ count: entries.length, entries });
}
