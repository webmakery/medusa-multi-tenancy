# Tenant Access Control Matrix

| Control ID | Control | Implementation in this change | Evidence Artifact |
|---|---|---|---|
| IAM-01 | Tenant admin SSO via federation | Tenant access config stores SAML/OIDC provider metadata and enforces `sso_required_for_admins`. | API response payload + audit log event `tenant_access_policy_updated` |
| IAM-02 | Optional SCIM provisioning | Provider configuration supports `scim_enabled`, `scim_base_url`, and `scim_auth_mode`. | Tenant access config for provider |
| IAM-03 | Session duration policy | `session_policy.max_session_duration_minutes` validates range 15-43200 minutes. | Tenant access config + validation errors |
| IAM-04 | MFA enforcement policy | `session_policy.mfa_enforced` stored tenant-scoped for policy engine consumption. | Tenant access config |
| IAM-05 | IP allowlisting | `session_policy.ip_allowlist` normalized and stored tenant-scoped. | Tenant access config |
| LOG-01 | Security configuration audit trail | Every policy update emits `tenant_access_policy_updated` with key counters. | Audit log records |
| GOV-01 | Security artifacts readiness | Architecture, control matrix, pen test summary, and incident policy documented. | `docs/security/*` and `docs/ops/*` |
| RM-01 | External assessment remediation tracking | Remediation register with owners, severity, due date, and closure evidence. | `docs/security/external-assessment-remediation-log.md` |
