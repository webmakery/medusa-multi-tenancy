# ADR 0001: Tenant Data Model and Isolation Invariants

- **Status:** Accepted
- **Date:** 2026-04-13
- **Owners:** Platform Architecture

## Context

This codebase already implements PostgreSQL Row Level Security (RLS), request-scoped tenant context (`x-tenant-id`), and tenant-aware service modules. The remaining architecture decision is to formalize the tenant data model and to define explicit isolation invariants that every persistence path must enforce.

The repository currently demonstrates:

- a shared PostgreSQL database with tenant context middleware and RLS hooks,
- tenant-scoped reads/writes in module services,
- tenant-aware admin/store API routes,
- analytics jobs and app webhook delivery paths that process tenant data.

## Decision

We will use **shared database + shared schema + `tenant_id` column + PostgreSQL RLS** as the canonical multi-tenant persistence model.

### Why this model

1. **Strong isolation with centralized enforcement** via RLS policies in the database.
2. **Operational simplicity** compared to schema-per-tenant or DB-per-tenant (single migration stream, single connection topology).
3. **Lower cost and better scale characteristics** for many small/medium tenants.
4. **Compatibility with existing implementation** (tenant context middleware, framework patch, and tenant-aware module services already align to this model).

### Alternatives considered

- **Schema-per-tenant:** stronger namespace separation but high migration/tooling complexity and operational burden.
- **DB-per-tenant:** strongest physical isolation but highest cost, provisioning overhead, and cross-tenant reporting friction.

Given current architecture and workload shape, shared DB + `tenant_id` + RLS is the best fit.

## Persistence layers that must enforce tenant context

The following layers are mandatory tenant-enforcement boundaries:

1. **ORM/data models and DB tables**
   - Every tenant-owned table must have `tenant_id`, tenant indexes, and RLS policies for `SELECT/INSERT/UPDATE/DELETE`.
2. **Query builders / raw SQL**
   - Any Knex/raw SQL query that touches tenant-owned data must execute with tenant context set (`app.current_tenant`) and/or explicit `tenant_id` predicates when required by business logic.
3. **Repository/service data access methods**
   - Service methods that compose DB operations must take (or derive) tenant scope and pass it to every read/write operation.
4. **Caches and in-memory key spaces**
   - Cache keys must include tenant identity. Shared/global keys are forbidden for tenant-owned payloads.
5. **File/object storage paths**
   - Object keys must be prefixed with tenant namespace, e.g. `tenants/{tenant_id}/...`.
6. **Search indexes and search documents**
   - Search documents must include tenant field and all queries must filter by tenant; index naming/aliasing must avoid cross-tenant leakage.
7. **Analytics events, rollups, and derived reporting tables**
   - Event ingestion, aggregation, and query endpoints must carry tenant scope through the full pipeline.
8. **Async/background execution channels**
   - Jobs, subscribers, and workflows must propagate tenant context explicitly (payload field and/or execution context) before data access.

## Tenant isolation invariants

### Invariant 1: Every read/write query requires tenant scope

- **Rule:** No tenant-owned read/write query is allowed without tenant scope.
- **Interpretation:** Either DB session tenant context is set for RLS, or query includes explicit `tenant_id` predicate (or both for defense in depth).

### Invariant 2: No global cache keys for tenant data

- **Rule:** Cache entries for tenant-owned data must include tenant identity in key format.
- **Interpretation:** Disallow keys like `orders:recent`; require `tenant:{tenant_id}:orders:recent`.

### Invariant 3: No cross-tenant joins unless explicitly approved for admin-only flows

- **Rule:** Joins across tenants are prohibited in product/store flows.
- **Interpretation:** Cross-tenant joins are only allowed in explicitly reviewed admin operations, with authorization checks and auditability.

## Enforcement map (invariant → code modules)

| Invariant | API middleware | Repositories / service layer | Background workers / subscribers | Reporting jobs |
|---|---|---|---|---|
| Every read/write query requires tenant scope | `src/modules/tenant-context/middleware.ts`, `src/api/middlewares.ts`, `src/api/utils/tenant.ts` | `src/modules/analytics/service.ts`, `src/modules/apps/service.ts`, `src/modules/theme/service.ts`, `src/modules/tenant-management/service.ts`, `src/modules/audit-log/service.ts` | `src/workflows/**`, `src/subscribers/**` (tenant context must be passed in event/workflow payloads before DB access) | `src/jobs/analytics-rollups.ts`, `src/jobs/analytics-top-products.ts` (must process per-tenant buckets only) |
| No global cache keys for tenant data | `src/api/middlewares.ts` (rate-limit bucket identity must remain tenant-qualified) | Any future cache wrapper used by module services must mandate tenant-qualified keys | Worker/job cache usage must include tenant prefix if introduced | Reporting cache layers (if added) must use tenant-qualified keys |
| No cross-tenant joins unless explicitly approved for admin-only flows | Admin/store route split under `src/api/admin/**` and `src/api/store/**`; tenant selection/authorization in middleware | Query composition in module services (joins must include tenant constraints for tenant-owned tables) | Worker/subscriber fan-out logic must avoid mixed-tenant joins in one execution unit | Reporting queries and materializations must stay tenant-scoped except approved admin-only aggregate flows |

## Consequences

### Positive

- Clear default model for all new modules and migrations.
- Consistent enforcement boundaries across sync and async paths.
- Reduced risk of accidental cross-tenant leakage.

### Tradeoffs

- Requires disciplined tenant propagation in every background and integration path.
- Admin/global analytics use cases require explicit review and documented exceptions.

## Implementation notes for future changes

- New tenant-owned tables must include `tenant_id` and RLS policies in migration PRs.
- New cache/search/storage integrations must include tenant key/namespace strategy in design docs.
- Any intentional cross-tenant admin report must include:
  1. explicit approval in ADR or follow-up decision note,
  2. route-level admin authorization,
  3. audit logging.
