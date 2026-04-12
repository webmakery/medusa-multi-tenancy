import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService from '../../../../../modules/tenant-management/service';

interface AcceptInvitationBody {
  invitation_token?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  const body = (req.body || {}) as AcceptInvitationBody;

  if (!body.invitation_token?.trim()) {
    return res.status(400).json({ message: 'invitation_token is required' });
  }

  try {
    const membership = await tenantManagementService.acceptInvitation({
      invitation_token: body.invitation_token,
    });

    return res.status(200).json({ membership });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to accept invitation.' });
  }
}
