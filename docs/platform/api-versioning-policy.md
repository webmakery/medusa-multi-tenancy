# API Versioning and Deprecation Policy

## Scope

This policy defines versioning for:
- **Public APIs** (partner/storefront and app-facing endpoints)
- **Internal APIs** (admin/internal service integration endpoints)

The goal is to keep integrations stable while allowing planned evolution.

## Version format

- Version syntax: `v<major>` (for example: `v1`, `v2`)
- Major versions are immutable contracts once marked stable.
- Non-breaking updates are shipped within a major version without changing the version number.

## Stability levels

| Level | Label | Contract |
| --- | --- | --- |
| Experimental | `beta` | Can change with notice in release notes; not covered by deprecation SLA. |
| Stable | `stable` | Backward compatible changes only; covered by deprecation timeline. |
| Deprecated | `deprecated` | Still available during sunset window; migration required by removal date. |
| Retired | `retired` | Requests rejected after the announced retirement date. |

## Public API policy

### Compatibility

For stable public APIs:
- Adding optional fields is allowed.
- Adding optional query parameters is allowed.
- Existing fields cannot be removed or renamed in-place.
- Existing required behavior cannot change in a breaking way.

Breaking changes require a new major version.

### Deprecation timeline

For stable public APIs, minimum deprecation windows are:

- **Deprecation notice:** at least **180 days** before retirement.
- **Migration period:** overlap period where old and new versions are both available.
- **Final retirement notice:** at least **30 days** before retirement.

### Communication channels

Deprecations are announced in:
- changelog/release notes
- developer docs migration guides
- integration owner notifications (email/webhook delivery diagnostics)

## Internal API policy

Internal APIs can evolve faster while staying predictable:

- Stable internal APIs require **90 days** deprecation notice.
- Critical security changes may shorten the window with incident documentation.
- Internal consumers must pin explicit versions in service configs.

## Version negotiation

- URI versioning is canonical: `/api/<audience>/v1/...`
- Header versioning may be used for preview toggles but does not replace major URI versions.
- Requests without explicit version to versioned endpoints are rejected with guidance.

## Sunset workflow

1. Mark endpoint/version as deprecated in docs and OpenAPI examples.
2. Emit runtime deprecation warnings in logs/observability for consumer tracking.
3. Provide migration doc with side-by-side request/response examples.
4. Monitor remaining traffic and contact owners.
5. Retire on published date and return clear error response.

## Standard retirement response

Retired versions return:
- `410 Gone`
- machine-readable error code: `api_version_retired`
- link to migration guide

## Ownership

- API Platform team owns policy updates.
- Product/domain teams own migration guides for their endpoints.
- Support owns partner-facing communication cadence.
