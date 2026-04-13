# Tenant backup, restore, and failover runbook

This runbook defines launch requirements for tenant data protection and recovery.

## 1) Backup policy and restore objectives

### Scope

- All tenant-scoped transactional data (orders, customers, products, inventory, memberships, app credentials, and audit logs).
- Shared control-plane metadata required to re-establish tenant routing and access control.

### Backup frequency

- **Continuous WAL + point-in-time recovery (PITR)**: enabled 24/7.
- **Full backup snapshot**: every **24 hours**.
- **Incremental snapshot**: every **4 hours**.
- **Retention**: minimum **35 days**.

### Recovery objectives

- **RPO (Recovery Point Objective)**: **15 minutes** maximum tenant data loss.
- **RTO (Recovery Time Objective)**:
  - **Single-tenant partial restore**: **60 minutes**.
  - **Full-platform restore**: **240 minutes**.

## 2) Non-production restore drills (required before launch)

Run both scenarios in staging (or a dedicated recovery environment) using production-like data volume.

### A. Partial restore drill (single tenant)

Goal: prove one tenant can be restored without impacting others.

Procedure:

1. Select a tenant and record baseline counts for tenant-scoped tables.
2. Simulate corruption/deletion for only that tenant.
3. Restore tenant data into a temporary recovery schema/table set from PITR/snapshot.
4. Replay/merge recovered rows into primary tables for the target tenant only.
5. Run tenant-boundary validation queries (see section 4).
6. Validate tenant application flows (read + write + auth).
7. Record elapsed time and compare against RTO.

Pass criteria:

- Restored tenant data is complete to within RPO.
- No cross-tenant rows are introduced.
- Recovery completes within 60 minutes.

### B. Full restore drill (all tenants)

Goal: prove full-environment recovery for regional/database failure.

Procedure:

1. Provision clean non-production environment.
2. Restore full backup + WAL/PITR to a target timestamp.
3. Reapply secrets/config required for service startup.
4. Run migrations/checks required by current release.
5. Execute smoke tests for admin APIs, store APIs, and authentication.
6. Run tenant-boundary integrity checks (section 4).
7. Record elapsed time and compare against RTO.

Pass criteria:

- Platform data recovered within 15-minute RPO.
- End-to-end services healthy.
- Recovery completes within 240 minutes.

## 3) Failover procedure and incident ownership

### Failover trigger examples

- Primary database unavailable > 5 minutes.
- Replica lag exceeds RPO threshold and is not recovering.
- Storage/data corruption in primary region.

### Procedure

1. **Declare incident** (SEV-1/SEV-2) and create incident channel.
2. **Assign ownership**:
   - Incident Commander (IC): Platform on-call lead.
   - Database Recovery Lead: Data platform on-call.
   - Application Recovery Lead: Backend on-call.
   - Communications Lead: Customer operations/support lead.
3. **Stabilize**: freeze risky writes if needed and capture failure timestamp.
4. **Promote recovery target** (replica or PITR-restored instance).
5. **Repoint services** to recovery target and validate connectivity.
6. **Run post-failover checks** (health, auth, tenant boundaries).
7. **Customer communication**: initial notice, hourly updates, resolution note.
8. **Close incident** after integrity checks pass and business approval is given.
9. **Post-incident review** within 5 business days.

### Ownership roster (must be populated before launch)

- Primary IC: _TBD_
- Secondary IC: _TBD_
- Database Recovery Lead: _TBD_
- Application Recovery Lead: _TBD_
- Communications Lead: _TBD_

## 4) Data integrity checks after restore (tenant boundaries)

Execute after every partial/full restore.

### Required checks

- Verify every tenant-scoped table has `tenant_id` populated and valid.
- Verify no orphaned references cross tenant boundaries.
- Verify row-level security context returns only in-tenant rows for sample users from multiple tenants.
- Verify aggregate counts per tenant match pre-backup baseline (within accepted delta for in-flight events).
- Verify no duplicated primary business records (orders/customers/products) from replay/merge.

### Example SQL checks

```sql
-- 1) Null tenant guard
SELECT COUNT(*) AS null_tenant_rows
FROM public.orders
WHERE tenant_id IS NULL;

-- 2) Cross-tenant join guard
SELECT COUNT(*) AS cross_tenant_links
FROM public.order_line_item oli
JOIN public.orders o ON o.id = oli.order_id
WHERE oli.tenant_id <> o.tenant_id;
```

### Evidence to retain

- Drill date/time and environment.
- Start/end timestamps and measured RTO.
- Recovery timestamp and measured RPO.
- SQL/check outputs for tenant boundary validation.
- Incident ticket/runbook version and owner approvals.

## 5) Launch readiness checklist

- [ ] Backup schedule configured (PITR + daily full + 4h incremental).
- [ ] RPO set to 15 minutes and operationally validated.
- [ ] RTO set to 60 minutes (single tenant) / 240 minutes (full restore).
- [ ] Single-tenant restore drill passed in non-production.
- [ ] Full restore drill passed in non-production.
- [ ] Failover procedure reviewed and approved by on-call teams.
- [ ] Incident ownership roster populated and on-call coverage confirmed.
- [ ] Post-restore tenant-boundary integrity checks passed and archived.
- [ ] Tenant isolation launch validation completed (`docs/ops/tenant-isolation-launch-validation.md`).
