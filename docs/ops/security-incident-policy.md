# Security Incident Policy (Tenant Identity & Access)

## Purpose
Define response expectations for security events affecting federated admin access (SSO/SAML/OIDC), SCIM provisioning, and tenant policy enforcement.

## Severity levels
- **SEV-1:** Active compromise, cross-tenant risk, or confirmed unauthorized admin access.
- **SEV-2:** Material control bypass in single tenant or high-confidence attempted compromise.
- **SEV-3:** Control degradation without confirmed exploit.

## Response SLAs
- **SEV-1:** Triage within 15 minutes, customer comms within 60 minutes.
- **SEV-2:** Triage within 60 minutes, customer comms within 4 hours.
- **SEV-3:** Triage within 1 business day.

## Required response workflow
1. Detect and classify incident severity.
2. Contain blast radius (disable affected IdP binding / revoke SCIM credentials / enforce step-up MFA).
3. Preserve evidence (audit logs, API gateway logs, IdP metadata snapshots).
4. Eradicate root cause and validate recovery.
5. Perform post-incident review with corrective actions.

## Mandatory evidence checklist
- Timeline of events (UTC)
- Affected tenants and users
- Indicators of compromise
- Remediation actions + rollback decisions
- Customer communications log
- Follow-up controls and due dates
