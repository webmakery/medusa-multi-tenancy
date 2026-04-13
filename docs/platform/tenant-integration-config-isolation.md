# Tenant-Specific Integration Config and Secret Isolation

## Principle

Every integration credential, webhook secret, endpoint token, and provider configuration must be isolated per tenant.

No integration secret may be shared across tenants.

## Data isolation requirements

- Persist integration credentials with `tenant_id`.
- Enforce tenant-level filtering at query time.
- Reject cross-tenant reads/writes in API handlers and background workers.
- Deactivate credentials automatically on tenant suspension or deletion workflows.

## Secret lifecycle controls

### Creation

- Generate high-entropy secrets per tenant integration install.
- Store only in approved secret-backed storage paths.
- Bind generated key IDs to a single tenant + app installation.

### Rotation

- Rotation creates a new active credential and deactivates old credential.
- Preserve rotation timestamp and key lineage for auditability.
- Support emergency rotation during incident response without tenant downtime.

### Revocation

- Revoked credentials must fail authentication immediately.
- Webhook signatures using revoked keys are rejected.

## Runtime handling rules

- Never log raw secrets.
- Redact credentials in API responses and admin UI.
- Keep only key metadata (`key_id`, rotation timestamps) visible to operators.
- Limit credential access to services that require signing or verification.

## Access model

- Tenant admins can rotate/revoke only their own integration credentials.
- Platform operators can perform break-glass recovery under audited admin context.
- All credential mutations produce audit log entries with actor and tenant context.

## Backup and recovery

- Secret metadata and integration records remain tenant-scoped in backup artifacts.
- Recovery workflows must restore credentials without mixing tenant namespaces.
- Post-restore validation must prove per-tenant credential integrity.

## Verification checklist

Before shipping an integration change, validate:

- `tenant_id` is present on all new integration tables.
- all integration queries are tenant-filtered.
- replay cache keys include tenant namespace.
- dead-letter and retry logs are tenant-addressable.
- admin APIs never expose plaintext secrets.
