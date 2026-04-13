# Surface Access Model

This document defines the three product surfaces, their route ownership, access roles, and branding level.

## 1) Platform Admin (internal team only)

### Purpose
Internal control plane used by platform operators for cross-tenant administration and operational governance.

### Route ownership
- **Primary route group:** `/admin/tenants*`
  - Examples: `/admin/tenants`, `/admin/tenants/active`, `/admin/tenants/:tenant_id`, `/admin/tenants/:tenant_id/suspend`, `/admin/tenants/:tenant_id/reactivate`, `/admin/tenants/:tenant_id/deletion-policy`.
- **Also includes internal governance/admin operations** exposed under the admin API surface when used by internal staff.

### Access roles
- **Platform Operator (internal):** full access to platform-level tenant lifecycle and governance routes.
- **Support/Operations (internal):** scoped access according to internal RBAC policy.
- **Not for tenant end users.**

> Note: tenant membership roles in code are `owner | admin | member | viewer`; platform-internal roles are a separate internal RBAC layer above tenant membership semantics.

### Branding level
- **Same system** (shared core design language).
- No tenant white-labeling on this surface.

---

## 2) Tenant Dashboard (customer admins/users)

### Purpose
Tenant-scoped back office for each customer tenant (catalog, orders, settings, apps, billing, team management).

### Route ownership
- **Primary route group:** `/admin/*` tenant-scoped APIs used by tenant-facing admin experiences.
- Canonical tenant route areas include:
  - `/admin/apps*`
  - `/admin/billing*`
  - `/admin/orders*`
  - `/admin/products*`
  - `/admin/inventory*`
  - `/admin/collections*`
  - `/admin/sales-channels*`
  - `/admin/settings*`
  - `/admin/themes*`
  - `/admin/team-members*`
- Tenant context is required and enforced via tenant-aware access checks.

### Access roles
Tenant membership roles are:
- **owner**
- **admin**
- **member**
- **viewer**

Privileged mutations (for example invites, member management, security settings, billing/lifecycle actions) are constrained to owner/admin, with some lifecycle actions owner-only.

### Branding level
- **Minor tenant branding** on top of the shared system (for example tenant theme/config and brand settings).
- Structural UI system remains consistent with platform admin patterns.

---

## 3) Public/Auth surface (signup/login/reset/invite accept)

### Purpose
Unauthenticated or pre-authentication entry points for onboarding and account/session establishment.

### Route ownership
- **Public onboarding:** `/store/tenants/signup`.
- **Invite acceptance:** `/admin/tenants/invitations/accept`.
- **Authentication endpoints:** `/auth/*` flows (login/session/password reset/identity workflows) provided by the auth subsystem.

### Access roles
- **Unauthenticated visitor:** can access signup/auth entrypoints.
- **Invited user (token holder):** can accept invitation.
- **Authenticated user:** transitions into Tenant Dashboard or Platform Admin according to membership + internal RBAC.

### Branding level
- **White-label capable** (tenant-specific logo/color/host-level branding can be applied at auth/onboarding touchpoints), while keeping core interaction patterns consistent.

---

## Routing and access summary table

| Surface | Route scope | Primary actors | Branding level |
|---|---|---|---|
| Platform Admin | `/admin/tenants*` (+ internal control-plane admin endpoints) | Internal platform operators/support | Same system |
| Tenant Dashboard | Tenant-scoped `/admin/*` business operations routes | Tenant `owner/admin/member/viewer` | Minor tenant branding |
| Public/Auth | `/store/tenants/signup`, `/admin/tenants/invitations/accept`, `/auth/*` | Unauthenticated visitors, invited users, authenticating users | White-label capable |
