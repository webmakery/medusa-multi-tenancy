# Tenant lifecycle policy

## Provisioning flow

When a tenant is created, provisioning is treated as an orchestration workflow:

1. Create the tenant record with lifecycle-aware defaults in `settings_json`.
2. Seed owner membership (`role=owner`, `status=active`).
3. Seed default sales channel and store configuration.
4. Persist audit event (`tenant_created`) for immutable traceability.

## Lifecycle states

- `active`: full access for members and integrations.
- `suspended`: access blocked for admin/store API and app integrations. Billing + audit history retained.
- `inactive`: deactivated tenant (same access blocking behavior as suspended).
- `pending_deletion`: soft-deleted state; tenant inaccessible, retained for legal/billing retention window.
- `deleted`: hard-deleted terminal state (only after retention + no legal hold).

## Suspension/deactivation behavior

- User and API access is blocked when tenant status is not `active`.
- Background jobs and outbound/inbound integration hooks only run for `active` tenants.
- Billing and audit data are explicitly preserved during suspension/deactivation.

## Deletion policy

- Strategy: **soft delete first**, then hard delete eligibility after retention window.
- Retention window: **90 days** (`TENANT_DELETION_RETENTION_DAYS`).
- Legal constraints:
  - `legal_hold=true` blocks deletion scheduling and hard deletion.
  - audit history and billing trail remain available throughout retention.

