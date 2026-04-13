# Security controls validation runbook

This runbook validates policy requirements for encryption, secret management, and backup/restore readiness.

## Controls

### 1) Encryption

- `KMS_KEY_ID` must be configured for managed key encryption.
- `BACKUP_ENCRYPTION_KEY_ID` must be configured and distinct from application defaults.
- `JWT_SECRET` and `COOKIE_SECRET` must be non-default, strong secrets (length >= 32).

### 2) Secret management

- `SECRET_PROVIDER` must be one of:
  - `aws-secrets-manager`
  - `gcp-secret-manager`
  - `hashicorp-vault`
- `SECRETS_LAST_ROTATED_AT` should be present as operational evidence.

### 3) Backup and restore readiness

- `BACKUP_PITR_ENABLED=true` (or equivalent truthy value).
- `BACKUP_RETENTION_DAYS >= 35`.
- `BACKUP_RESTORE_DRILL_LAST_AT` should be present as restore-drill evidence.

## Automated validation

Run:

```bash
yarn security:validate-controls
```

Expected outcome:

- exits with code `0` when mandatory controls are present and policy-compliant.
- exits with non-zero code when mandatory controls are missing or non-compliant.
- prints warnings for evidence-only metadata keys that should be supplied by operations.

## Policy mapping

| Requirement | Validation source |
|---|---|
| Encryption keys configured | `KMS_KEY_ID`, `BACKUP_ENCRYPTION_KEY_ID` checks |
| Secrets are centrally managed | `SECRET_PROVIDER` allowed-values check |
| Secrets are strong/non-default | `JWT_SECRET`, `COOKIE_SECRET` checks |
| Backups support retention + PITR | `BACKUP_RETENTION_DAYS`, `BACKUP_PITR_ENABLED` checks |
| Restore process is exercised | `BACKUP_RESTORE_DRILL_LAST_AT` warning signal |
