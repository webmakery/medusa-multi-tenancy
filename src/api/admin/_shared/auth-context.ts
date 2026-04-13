import { MedusaRequest } from '@medusajs/framework/http';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getActorEmail(req: MedusaRequest): string | null {
  const authContext = (req as any).auth_context;

  const possibleEmails = [
    authContext?.actor_email,
    authContext?.email,
    authContext?.actor_id,
    authContext?.actor?.email,
    authContext?.auth_identity?.app_metadata?.email,
    authContext?.user_metadata?.email,
    req.headers['x-user-email'],
  ];

  for (const value of possibleEmails) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized.includes('@')) {
        return normalized;
      }
    }
  }

  return null;
}

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || !UUID_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getActiveTenantIdFromAuthContext(req: MedusaRequest): string | null {
  const authContext = (req as any).auth_context;

  return (
    normalizeUuid(authContext?.app_metadata?.active_tenant_id) ||
    normalizeUuid(authContext?.auth_identity?.app_metadata?.active_tenant_id) ||
    normalizeUuid(authContext?.user_metadata?.active_tenant_id) ||
    null
  );
}

export function getTenantRoleFromAuthContext(req: MedusaRequest): string | null {
  const authContext = (req as any).auth_context;

  const roleCandidates = [
    authContext?.app_metadata?.tenant_role,
    authContext?.auth_identity?.app_metadata?.tenant_role,
    authContext?.user_metadata?.tenant_role,
  ];

  for (const role of roleCandidates) {
    if (typeof role === 'string' && role.trim()) {
      return role.trim().toLowerCase();
    }
  }

  return null;
}
