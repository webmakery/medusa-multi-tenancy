# Incident Response Program

This document establishes a shared incident management model for multitenant operations, including severity levels, prescriptive runbooks, on-call escalation, game-day drills, and a required postmortem template.

## 1) Severity model (SEV1–SEV4)

Use the highest applicable severity at incident start. Severity can be downgraded only after customer impact is materially reduced.

| Severity            | Customer impact                                                                                    | Typical examples                                                                                               | Incident commander required       | Update cadence   | Initial acknowledgment SLA | Mitigation target SLA |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------- | -------------------------- | --------------------- |
| **SEV1 (Critical)** | Widespread production outage or data isolation/security risk across tenants; no viable workaround  | Cross-tenant data exposure, global auth outage, billing system down blocking checkout/subscription enforcement | Yes (immediate)                   | Every 15 minutes | 5 minutes                  | 60 minutes            |
| **SEV2 (High)**     | Major functionality degraded for multiple tenants or key workflow blocked for one high-tier tenant | Regional auth failures, delayed billing webhook processing, queue backlog causing order delays                 | Yes (within 15 minutes)           | Every 30 minutes | 15 minutes                 | 4 hours               |
| **SEV3 (Medium)**   | Limited-scope degradation with workaround; minor breach of SLO                                     | Partial queue lag, intermittent billing sync failures, tenant-specific auth latency                            | Optional (service owner can lead) | Every 4 hours    | 1 hour                     | 1 business day        |
| **SEV4 (Low)**      | Minimal impact, cosmetic, or operational risk with no active customer harm                         | Alert noise, recoverable job retries, documentation/runbook gaps discovered in ops                             | No (ticket workflow)              | Daily via ticket | 1 business day             | Planned release cycle |

### Severity guardrails

- Any credible **tenant isolation** concern is automatically **SEV1** until disproven.
- If incident scope is unknown after 15 minutes, default to the higher severity.
- Re-severity decisions must be timestamped in the incident timeline.

---

## 2) Incident runbooks

Each incident must have: `incident commander`, `communications lead`, and `operations lead`.

### 2.1 Tenant isolation incident runbook

**Default severity:** SEV1.

#### Detection signals

- Cross-tenant access test fails (RLS/security integration tests, production canary checks).
- Audit log indicates mismatched `tenant_id` and resource ownership.
- Support report of one tenant viewing another tenant's data.

#### Immediate actions (0–15 minutes)

1. Declare incident as **SEV1** and page primary + secondary on-call.
2. Freeze risky write paths (tenant-affecting admin writes, bulk import/export, background fan-out jobs).
3. Enable emergency access controls:
   - Tighten tenant middleware checks.
   - Block affected endpoints/routes if scope is uncertain.
4. Snapshot evidence (request IDs, trace IDs, affected tenants, first-seen timestamp).

#### Containment and mitigation (15–60 minutes)

1. Determine blast radius:
   - Which endpoint/workflow leaked data?
   - Read-only leak or write corruption?
   - Number of impacted tenants.
2. Apply containment fix (feature flag off, route block, policy rollback, hotfix deploy).
3. Validate with targeted tenant isolation probes and regression checks.
4. If data mutation occurred, start corrective workflow:
   - Restore from authoritative source/backups.
   - Reconcile affected records by tenant.

#### Recovery criteria

- Isolation tests pass for affected and unaffected tenant samples.
- Temporary blocks removed only after two-person review.
- Security + legal/compliance notification requirements completed.

#### Stakeholder communication

- Internal exec/security update every 15 minutes until contained.
- Customer updates coordinated with Support/CSM and legal approval.

---

### 2.2 Authentication outage runbook

**Default severity:** SEV1 if global login fails, otherwise SEV2.

#### Detection signals

- Login success SLI drops below objective.
- Spike in auth API 5xx or token validation failures.
- External identity provider (IdP) dependency alert.

#### Immediate actions (0–15 minutes)

1. Confirm scope: admin login, store login, API token issuance, session refresh.
2. Start status page investigation notice if customer-facing impact is broad.
3. Fail over to known-safe auth config where possible:
   - Revert recent auth config/deploy.
   - Route to standby IdP/region if configured.
4. Temporarily extend token/session TTL (if security policy allows) to reduce forced re-login load.

#### Mitigation actions

1. Recover token issuance/validation path.
2. Scale auth service/cache backing store.
3. Replay/retry failed auth events where required.
4. Verify end-to-end login for each user type (admin, member, customer).

#### Recovery criteria

- Auth success rate stable above SLO for 30 consecutive minutes.
- No sustained error spikes in auth endpoints.
- Status page moved from investigating to resolved.

---

### 2.3 Billing outage runbook

**Default severity:** SEV2, escalate to SEV1 if revenue capture/entitlement enforcement is broadly blocked.

#### Detection signals

- Billing status endpoint failure or sustained 5xx.
- Payment processor webhook delays/failures.
- Entitlement mismatches (paid tenant treated as unpaid).

#### Immediate actions (0–30 minutes)

1. Validate impact dimension:
   - Invoice generation
   - Payment capture
   - Entitlement enforcement
2. Engage finance ops + billing service owner.
3. Activate safe-mode policy:
   - Fail-open for existing paid entitlements for limited window.
   - Queue and persist billing events for replay.

#### Mitigation actions

1. Restore billing dependency connectivity (processor API, DB, queue).
2. Replay backlog in order with idempotency keys.
3. Reconcile ledger:
   - Compare metered usage vs invoiced usage.
   - Validate credits/refunds and failed charge retries.
4. Run entitlement reconciliation job for impacted tenants.

#### Recovery criteria

- Billing APIs healthy and event lag within normal threshold.
- Entitlement state reconciled for all impacted tenants.
- Finance ops signs off on reconciliation report.

---

### 2.4 Queue backlog runbook

**Default severity:** SEV2 when customer workflows are delayed; SEV3 for non-customer-facing lag.

#### Detection signals

- Queue depth and lag exceed alert thresholds.
- Oldest message age growing.
- Worker failure/retry storm.

#### Immediate actions (0–20 minutes)

1. Identify impacted queues and business functions (orders, webhooks, analytics, billing).
2. Check for poison messages or dependency outage causing retry loops.
3. Apply backpressure controls:
   - Pause non-critical producers.
   - Prioritize customer-facing queues.
4. Increase worker concurrency only after dependency health check.

#### Mitigation actions

1. Drain queue by priority tiers.
2. Quarantine poison messages and open follow-up defect.
3. Reprocess dead-letter queue entries safely.
4. Confirm downstream service saturation is not worsening.

#### Recovery criteria

- Queue lag and depth return to steady-state SLO band.
- Oldest message age below alert threshold.
- No active retry storm for 30 minutes.

---

## 3) On-call rotations and escalation policy

### Rotation structure

- **Primary on-call (24x7, weekly rotation):** first responder, owns triage and incident declaration.
- **Secondary on-call (24x7, weekly rotation):** auto-paged for SEV1 immediately and SEV2 if primary has not acknowledged within SLA.
- **Incident commander pool:** senior engineers/SREs who can assume command for SEV1/SEV2.
- **Domain escalation roster:** auth, tenant isolation/security, billing, queue/platform specialists.

### Escalation flow

1. Alert fires to **primary**.
2. If no acknowledgment within SLA, auto-page **secondary**.
3. If still unacknowledged after next SLA step, auto-escalate to **incident commander** and engineering manager.
4. For SEV1, page security lead immediately when tenant isolation or auth compromise is possible.

### Response SLAs

| Severity | Primary acknowledgment | Secondary escalation   | Commander escalation | Stakeholder update start |
| -------- | ---------------------- | ---------------------- | -------------------- | ------------------------ |
| SEV1     | <= 5 minutes           | at 5 minutes           | at 10 minutes        | <= 15 minutes            |
| SEV2     | <= 15 minutes          | at 15 minutes          | at 30 minutes        | <= 30 minutes            |
| SEV3     | <= 60 minutes          | at 90 minutes          | at 4 hours           | next business update     |
| SEV4     | <= 1 business day      | ticket escalation only | N/A                  | weekly ops review        |

### Operational requirements

- Publish rotation schedule at least 8 weeks ahead.
- Enforce handoff notes at every rotation change.
- Require backup contacts for PTO/leave coverage.

---

## 4) Game-day drills (top 3 incident types)

Run quarterly game-days for the highest-risk incident classes and capture detection and mitigation performance.

### Drill scorecard fields

- Scenario ID and date
- Trigger method (synthetic, chaos, replay)
- **Time-to-detect (TTD)**: from injected fault to incident declaration
- **Time-to-mitigate (TTM)**: from declaration to customer-impact containment
- Gaps found
- Corrective actions with owner and due date

### Most recent drill outcomes

| Scenario                                           | Date       | Severity target | TTD    | TTM    | Outcome summary                                                                  |
| -------------------------------------------------- | ---------- | --------------- | ------ | ------ | -------------------------------------------------------------------------------- |
| Tenant isolation policy bypass simulation          | 2026-04-08 | SEV1            | 4 min  | 41 min | Met SEV1 detection SLA; mitigation slowed by manual tenant blast-radius query.   |
| Authentication provider regional outage simulation | 2026-04-09 | SEV1            | 6 min  | 52 min | Slightly missed detection SLA; mitigation met target after standby IdP failover. |
| Queue backlog retry storm simulation               | 2026-04-10 | SEV2            | 11 min | 96 min | Met SEV2 SLAs; improved with queue prioritization and poison-message quarantine. |

### Drill follow-up policy

- Any drill that misses SLA requires a corrective action within 2 business days.
- Repeat failed scenario in the next monthly reliability exercise.

---

## 5) Postmortem template (required)

Use this template for all SEV1/SEV2 incidents and any SEV3 incident with customer-visible impact.

```md
# Incident Postmortem: <INCIDENT-ID / TITLE>

## 1. Summary

- Incident date:
- Severity:
- Services impacted:
- Customer impact summary:

## 2. Timeline (UTC)

- <timestamp> detection signal observed
- <timestamp> incident declared
- <timestamp> mitigation applied
- <timestamp> incident resolved

## 3. Root cause analysis

- Technical root cause:
- Contributing factors:
- Why existing controls did not prevent/detect earlier:

## 4. Impact assessment

- Tenant count impacted:
- Duration of impact:
- Data integrity/security impact:
- Financial impact estimate:

## 5. What went well

-

## 6. What did not go well

-

## 7. Corrective actions (mandatory)

| Action        | Owner (mandatory) | Due date (mandatory) | Priority   | Status                  |
| ------------- | ----------------- | -------------------- | ---------- | ----------------------- |
| <action item> | <name>            | <YYYY-MM-DD>         | <P0/P1/P2> | <open/in-progress/done> |

## 8. Verification plan

- How we will validate each corrective action:
- Monitoring/alert changes required:

## 9. Approvals

- Incident commander:
- Service owner:
- Engineering manager:
```

### Postmortem policy requirements

- Draft due within 3 business days of incident resolution.
- Final review and sign-off due within 7 business days.
- Incident is not considered fully closed until all corrective actions have owner + due date assigned.
