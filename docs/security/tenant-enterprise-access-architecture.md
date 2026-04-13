# Tenant Enterprise Access Architecture (SSO/SAML/OIDC + Optional SCIM)

## Scope
This architecture supports tenant-admin authentication using customer identity providers (IdP) over SAML 2.0 or OIDC, with optional SCIM 2.0 provisioning for lifecycle automation.

## High-level architecture
```mermaid
flowchart LR
  A[Tenant Admin User] --> B[Customer IdP\n(Okta/Azure AD/Ping)]
  B -->|SAML Assertion / OIDC ID Token| C[Shopify Admin Auth Gateway]
  C --> D[Tenant Access Policy Engine]
  D -->|Enforce| E[Session Policy\nDuration/MFA/IP Allowlist]
  D --> F[Tenant Context Resolver]
  F --> G[Admin APIs]
  B -->|Optional SCIM 2.0| H[SCIM Provisioning Endpoint]
  H --> I[Tenant Membership Service]
  I --> J[Audit Log]
  G --> J
```

## Trust boundaries
- External IdP boundary: assertion/token signature validation, issuer/audience checks, replay resistance.
- Tenant policy boundary: all session and network controls are tenant-scoped and evaluated per request.
- Provisioning boundary: SCIM endpoint only manages identities for the bound tenant and requires scoped credentials.

## Control objectives
1. **Strong federation**: SAML/OIDC trust must be explicit per tenant.
2. **Session hardening**: customer-managed max session duration, MFA enforcement, IP allowlist.
3. **Least privilege lifecycle**: SCIM create/update/deactivate users and group-role mappings.
4. **Auditability**: policy changes, login decisions, provisioning actions, and admin operations logged.

## Deployment notes
- One or more IdP definitions can exist per tenant.
- SCIM is optional and only enabled when tenant provides endpoint + auth settings.
- Break-glass local owner account should be retained and separately monitored.
