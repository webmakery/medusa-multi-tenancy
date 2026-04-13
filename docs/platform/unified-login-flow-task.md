# Task: Unify admin + tenant login entrypoint, keep tenant-only signup

## Why

We should support a single login URL (for example `/app/login`) for both admins and tenant users, then redirect based on role/membership after authentication.

This improves discoverability, reduces duplicated auth UI, and aligns with existing backend behavior where `POST /login` already returns role-aware `redirect_to` values.

## Current state (already in code)

- `POST /login` authenticates email/password and returns:
  - `redirect_to: /platform-admin` for platform admins.
  - `redirect_to: /t/{tenant_slug}` for users with exactly one active tenant membership.
  - `redirect_to: /tenant-picker` otherwise.
- `POST /signup` already aliases tenant signup (`/store/tenants/signup`).

## Implementation task

### Scope

1. Keep **one shared login page** at `/app/login` for both admins and tenants.
2. Keep **tenant signup only** as a separate page (for example `/app/signup`), wired to tenant signup APIs.
3. Ensure login submit uses `POST /login` and always follows backend `redirect_to`.
4. Remove/redirect any duplicate admin- vs tenant-specific login URLs to `/app/login`.
5. Preserve existing auth security controls (rate limiting, session handling, and error handling).

### Delivery checklist

- [ ] Inventory existing frontend routes/pages that expose separate admin vs tenant login URLs.
- [ ] Add/confirm canonical login route: `/app/login`.
- [ ] Update all auth entry CTAs/links to point to `/app/login`.
- [ ] Keep signup CTA available for tenant registration only.
- [ ] Ensure successful login follows server-provided `redirect_to` without client-side role hardcoding.
- [ ] Validate behavior for:
  - [ ] platform admin account
  - [ ] tenant user with one membership
  - [ ] tenant user with multiple memberships (lands on tenant picker)
  - [ ] invalid credentials
- [ ] Add/update integration tests for shared login routing and post-auth redirects.
- [ ] Add migration notes for external links/bookmarks that used old login URLs.

### Non-goals

- No redesign of auth forms.
- No changes to tenant signup verification workflow.
- No role model or authorization policy changes.

## Acceptance criteria

1. Both admin and tenant users can sign in from `/app/login`.
2. Post-login redirects are role/membership-aware and come from backend `redirect_to`.
3. Tenant signup remains available and functional through its dedicated signup page.
4. Legacy login URLs either 301/302 redirect or are removed with clear replacement to `/app/login`.
5. Automated tests cover the role-based redirect matrix.

## Suggested owner

- Platform Auth + Admin UI team.

## Priority

- High (reduces auth friction and duplicated entrypoints).
