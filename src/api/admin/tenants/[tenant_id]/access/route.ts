import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { TENANT_MANAGEMENT_MODULE } from '../../../../../modules/tenant-management';
import TenantManagementModuleService, {
  TenantAccessConfigurationInput,
  TenantIdentityProviderInput,
} from '../../../../../modules/tenant-management/service';
import { authorizeTenantAction } from '../../_shared/authorization';

function isValidProvider(provider: any): provider is TenantIdentityProviderInput {
  if (!provider || typeof provider !== 'object') {
    return false;
  }

  if (!['saml', 'oidc'].includes(provider.protocol)) {
    return false;
  }

  if (typeof provider.provider_name !== 'string' || !provider.provider_name.trim()) {
    return false;
  }

  return true;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authorization = await authorizeTenantAction(req, res, 'manage_security');
  if (!authorization.allowed) {
    return;
  }

  const { tenant_id } = req.params;
  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  try {
    const config = await tenantManagementService.getTenantAccessConfiguration(tenant_id);

    return res.status(200).json({
      tenant_id,
      access_control: config,
    });
  } catch (error: any) {
    return res.status(404).json({ message: error.message || 'Tenant not found.' });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const authorization = await authorizeTenantAction(req, res, 'manage_security');
  if (!authorization.allowed) {
    return;
  }

  const { tenant_id } = req.params;
  const body = (req.body || {}) as TenantAccessConfigurationInput;

  if (body.identity_providers && !Array.isArray(body.identity_providers)) {
    return res.status(400).json({ message: 'identity_providers must be an array when provided.' });
  }

  if (body.identity_providers?.some((provider) => !isValidProvider(provider))) {
    return res.status(400).json({ message: 'Each identity provider requires a valid protocol (saml|oidc) and provider_name.' });
  }

  const tenantManagementService: TenantManagementModuleService = req.scope.resolve(TENANT_MANAGEMENT_MODULE);

  try {
    const accessControl = await tenantManagementService.updateTenantAccessConfiguration({
      tenant_id,
      actor: authorization.actorEmail,
      config: body,
    });

    return res.status(200).json({
      tenant_id,
      message: 'Tenant access configuration saved.',
      access_control: accessControl,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Unable to update tenant access configuration.' });
  }
}
