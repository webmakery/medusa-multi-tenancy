# Tenant isolation threat model and security test plan

## Scope

This threat model is focused on:

- tenant isolation failure modes in admin APIs and background workflows,
- privilege escalation paths inside tenant member management,
- IDOR and broken access control attack classes,
- tenant-switch tampering against `x-tenant-id` and active tenant session state.

## Assets and trust boundaries

### Sensitive assets

- tenant-owned commerce records (orders, customers, products, analytics).
- tenant membership, role assignments, and ownership state.
- tenant billing account state and usage signals.
- audit logs used for forensic response and compliance controls.

### Trust boundaries

1. **Request boundary:** user-controlled headers/body/query (`x-tenant-id`, route params, payload IDs).
2. **Auth/session boundary:** `auth_context` + JWT cookie active tenant metadata.
3. **Service boundary:** tenant-management and billing modules.
4. **Persistence boundary:** PostgreSQL RLS + explicit tenant filters + immutable audit table.

## Priority failure modes

| Threat | Failure mode | Impact | Existing/required control |
|---|---|---|---|
| Cross-tenant IDOR | Attacker reuses known resource IDs (`member_id`, `tenant_id`) from another tenant. | Unauthorized read/write across tenant boundary. | Tenant-scoped lookup clauses (`WHERE id=:id AND tenant_id=:tenant`) + membership authorization. |
| Broken access control | Authenticated user calls owner/admin endpoints without tenant membership or role. | Privilege abuse (member updates, tenant lifecycle, billing mutations). | Role checks in `authorizeTenantAction` and `resolveAuthenticatedTenantAccess`. |
| Tenant-switch tampering | User sends mismatched `x-tenant-id` while session cookie is set to a different active tenant. | Cross-tenant confusion, unintended mutations in wrong tenant. | 409 tenant mismatch guard when actor has multi-tenant memberships. |
| Audit trail erasure | Admin/operator updates or deletes prior security events. | Lost forensic evidence and compliance failure. | DB-level immutable trigger that blocks `UPDATE`/`DELETE` on `audit_log`. |
| Billing privilege escalation | Unauthorized actor changes payment lifecycle state. | Revenue fraud, forced suspension/reactivation. | Owner/admin role gate + audit events for billing status changes. |

## Threat scenarios and abuse cases

1. **IDOR on role mutation**
   - Attempt: tenant A owner calls role update endpoint with a tenant B `member_id`.
   - Expected: `Member not found` within tenant A scope; no mutation of tenant B row.

2. **Broken access control on billing action**
   - Attempt: actor from tenant A posts billing action against tenant B via forged `x-tenant-id`.
   - Expected: `403 You are not an active member of this tenant`.

3. **Tenant-switch tampering**
   - Attempt: authenticated multi-tenant actor sets active tenant cookie to tenant A, then calls tenant B endpoint with `x-tenant-id`.
   - Expected: `409 Tenant mismatch` and no data access.

4. **Audit log mutation**
   - Attempt: issue direct SQL `UPDATE audit_log ...` or `DELETE FROM audit_log`.
   - Expected: database exception (`audit_log rows are immutable`).

## Security test execution

Run the focused security suite:

```bash
yarn jest integration-tests/http/tenant-context/security-access-control.spec.ts --runInBand --forceExit
```

The suite validates:

- IDOR prevention on role updates,
- broken access control on billing status mutations,
- tenant-switch tampering detection.

## Residual risks and follow-up

- Add periodic negative tests for cross-tenant access on every newly introduced admin mutation endpoint.
- Include immutable audit mutation checks in database migration CI smoke tests.
- Add alerting on repeated 409 tenant mismatch responses as potential account-takeover probing.
