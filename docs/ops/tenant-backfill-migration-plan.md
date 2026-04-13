# Tenant Backfill Migration Plan (Phased Rollout)

This runbook defines a safe migration rollout for introducing or enforcing `tenant_id` on existing tenant-owned records.

## Scope

Applies to any table that will receive backfilled `tenant_id` values and then move to strict constraints (for example, `NOT NULL`, FK enforcement, or RLS hardening).

---

## Phase 0 — Preflight + schema preparation

### Change

1. Add schema elements in a backward-compatible way:
   - add nullable `tenant_id` columns (if not already present)
   - add indexes concurrently where supported
   - add non-blocking FK constraints as `NOT VALID` first (when available)
2. Deploy app code that can read/write both legacy and new shape.

### Validation gates

Run baseline capture before any backfill:

```bash
node ./scripts/backfill-capture-baseline.js \
  --tables app_installation,app_scope,app_webhook,app_credential,app_webhook_delivery_log \
  --output ./artifacts/pre-backfill-baseline.json
```

### Rollback

- If this phase fails before app deploy: revert migration commit and re-run migrations down.
- If app deploy already occurred: keep dual-read compatibility code, roll back schema migration only if no writes touched new column.

### Production stop conditions

Stop and do not proceed if any of these occur:

- migration lock waits exceed 60 seconds
- DDL statement exceeds 5 minutes on primary
- replication lag exceeds 30 seconds for more than 5 minutes

---

## Phase 1 — Backfill (idempotent, chunked)

### Change

1. Run backfill in deterministic chunks (for example by `id` range or `created_at` windows).
2. Use idempotent updates (`WHERE tenant_id IS NULL`) so retries are safe.
3. Record per-batch metrics: rows scanned, rows updated, duration, errors.

### Validation gates

- During run: row counts per table must remain constant.
- End of run: every target row must have a valid `tenant_id`.

```bash
node ./scripts/backfill-validate.js --baseline ./artifacts/pre-backfill-baseline.json
```

### Rollback

- Stop workers immediately.
- Re-deploy previous application version (still dual-read compatible).
- If incorrect assignments detected, restore impacted rows from backup or point-in-time recovery into a repair table, then replay valid updates.

### Production stop conditions

Stop backfill immediately when:

- validation shows row count drift in any table
- validation shows orphan tenant assignments
- batch error rate exceeds 0.5% over 10 minutes
- DB CPU stays above 80% for 15 minutes due to backfill workload

---

## Phase 2 — Dual-write and dual-read compatibility window

### Change

1. Keep application in compatibility mode for a full observation window.
2. Writes must populate `tenant_id` for all new/updated records.
3. Reads should tolerate both legacy and tenant-scoped paths only if required by older data contracts.

### Minimum window

- 7 days in production after successful backfill.
- Include at least one peak-traffic period in this window.

### Validation gates

- Daily run of validation script against previous baseline (count drift + tenant integrity).
- Error budget unchanged for write/read endpoints touching migrated tables.

### Rollback

- Revert to prior app build with compatibility mode still enabled.
- Keep schema as-is (do not drop `tenant_id`) until issue is understood.

### Production stop conditions

Stop cleanup promotion if:

- tenant-scoped endpoint regression > 1% above baseline
- any newly written row appears with `tenant_id IS NULL`
- cross-tenant leakage incident is suspected

---

## Phase 3 — Cleanup and enforcement

### Change

1. Enforce constraints after compatibility window:
   - set `tenant_id` to `NOT NULL`
   - validate and enforce FK constraints
   - remove legacy fallback reads/writes
2. Remove temporary migration feature flags.

### Validation gates

- Re-run full validation immediately after cleanup deploy.
- Confirm no code path writes legacy shape.

### Rollback

- If enforcement migration fails: roll back app first, then revert latest migration.
- If cleanup app deploy fails but schema is valid: hotfix app; avoid partial schema rollback unless data corruption is proven.

### Production stop conditions

Stop rollout if:

- constraint validation fails on any table
- P95 latency for critical write paths increases > 20% for 30 minutes
- sustained deadlock increase tied to new constraints

---

## Validation scripts (pre/post backfill)

### 1) Capture baseline before backfill

```bash
node ./scripts/backfill-capture-baseline.js \
  --tables app_installation,app_scope,app_webhook,app_credential,app_webhook_delivery_log \
  --output ./artifacts/pre-backfill-baseline.json
```

This snapshot captures:

- total row count per table
- `tenant_id IS NULL` count (where column exists)
- orphan `tenant_id` references (tenant missing from `tenant` table)
- per-tenant distribution (for forensic analysis)

### 2) Validate after each backfill run and before cleanup

```bash
node ./scripts/backfill-validate.js --baseline ./artifacts/pre-backfill-baseline.json
```

This validator fails fast when:

- table row counts changed unexpectedly
- any row still has `tenant_id IS NULL`
- any row points at a missing tenant

---

## Staging dry run schedule (production-like volume)

**Planned dry run:** April 17, 2026 (Friday), 14:00–16:00 UTC.

### Preconditions

- staging restored from a recent production snapshot with similar row counts
- identical migration and app build artifacts as production candidate
- background jobs enabled to mimic production write behavior

### Dry run steps

1. Phase 0 schema changes in staging.
2. Capture baseline with `backfill-capture-baseline.js`.
3. Execute backfill with production batch sizes.
4. Run `backfill-validate.js` after each major table batch.
5. Keep compatibility mode enabled for at least 24 hours in staging.
6. Run cleanup/enforcement migration.

### Timing capture template

- schema migration wall time per statement
- backfill rows/sec per table
- max lock wait time observed
- max replication lag observed
- post-deploy P50/P95 latency deltas

### Risk notes to capture

- tables with highest lock contention
- batch size thresholds that cause CPU or I/O saturation
- any query plans switching to sequential scans
- any tenant assignment anomalies requiring manual repair

