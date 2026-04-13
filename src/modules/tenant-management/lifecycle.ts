export const TENANT_DELETION_RETENTION_DAYS = 90;

export type TenantStatus =
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'pending_deletion'
  | 'deleted';

export const BLOCKED_TENANT_STATUSES: TenantStatus[] = ['suspended', 'inactive', 'pending_deletion', 'deleted'];

export function isTenantAccessBlocked(status?: string | null): boolean {
  if (!status) {
    return true;
  }

  return BLOCKED_TENANT_STATUSES.includes(status as TenantStatus);
}

