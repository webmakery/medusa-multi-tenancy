# Tenant Capacity, Load, and Chaos Validation Runbook

This runbook defines how to model realistic multi-tenant traffic, find platform saturation points, validate autoscaling, and continuously verify capacity headroom before major releases.

## 1) Scope and outcomes

Use this runbook to answer four questions:

1. Does the environment handle realistic tenant mix (many small tenants and a few large tenants)?
2. Where do hard and soft saturation limits appear (database, queueing, CPU, latency)?
3. Do autoscaling policies react early enough and recover safely under stress?
4. Is there enough release headroom, and how often is it re-validated?

## 2) Real-tenant load profiles

Model each test run with weighted tenant cohorts. Keep the ratio stable across releases unless production distribution materially changes.

### Tenant cohorts

- **Small tenants (long tail)**
  - Weight: 85% of tenants
  - Traffic share: 40% of requests
  - Pattern: bursty interactive API calls, lower sustained background load
- **Medium tenants**
  - Weight: 12% of tenants
  - Traffic share: 35% of requests
  - Pattern: mixed API and scheduled jobs
- **Large tenants (top accounts)**
  - Weight: 3% of tenants
  - Traffic share: 25% of requests
  - Pattern: sustained high request rate, high webhook/job concurrency

### Required workload mix by operation

- Login/auth: 5%
- Read API: 45%
- Write API: 20%
- Reporting requests: 10%
- Webhook deliveries: 10%
- Background jobs: 10%

### Load stages

For each scenario, run these stages in order:

1. **Warm-up**: 15 minutes at 50% expected peak.
2. **Steady-state**: 45 minutes at 100% expected peak.
3. **Stress ramp**: increase 10% every 10 minutes until first saturation trigger.
4. **Recovery**: return to 70% expected peak and confirm metric recovery for 20 minutes.

### Data realism requirements

- Seed tenant IDs across all tiers (`starter`, `growth/pro`, `enterprise`).
- Include skewed key access patterns so hot tenants/hot partitions are exercised.
- Include realistic retry behavior and background scheduling intervals.
- Preserve correlation IDs and tenant labels to support per-tenant analysis.

## 3) Saturation point identification

Saturation is declared when **any** threshold is crossed for at least 5 consecutive minutes during steady-state or ramp stages.

### Primary saturation signals

- **DB connection pressure**
  - Warning: DB pool usage >= 75%
  - Saturation: DB pool usage >= 85% or connection wait p95 >= 50ms
- **Queue depth/lag pressure**
  - Warning: queue depth >= 2x normal baseline for 10m
  - Saturation: queue depth >= 3x baseline or queue lag p95 >= 120s
- **Compute pressure**
  - Warning: CPU >= 65% for 10m
  - Saturation: CPU >= 75% for 5m or run queue growth without recovery
- **User-visible latency pressure**
  - Warning: API p95 above SLO threshold for 10m
  - Saturation: API p95 above SLO threshold for 20m or p99 > 2x SLO threshold

### Required artifacts per run

Capture and attach:

- Throughput vs p95/p99 latency curve (knee point highlighted)
- DB pool utilization + wait-time timeline
- Queue depth + lag timeline by queue
- CPU/memory timeline by service
- Saturation trigger timestamp and first-bottleneck component

## 4) Autoscaling policy definition

Autoscaling should trigger before hard saturation and avoid oscillation.

### API service autoscaling

- **Scale out conditions** (any 2 of 3 sustained for 5m):
  - CPU >= 60%
  - API p95 >= 80% of tier SLO threshold
  - In-flight request concurrency >= 75% of safe concurrency per pod
- **Scale in conditions** (all for 20m):
  - CPU <= 35%
  - API p95 <= 60% of SLO threshold
  - In-flight concurrency <= 40% of safe concurrency
- **Guardrails**:
  - Cooldown: 5m scale-out, 15m scale-in
  - Step size: +25% replicas per action, max 2 actions in 10m
  - Min replicas per tier-isolated environment: keep enough capacity for N-1 node loss

### Worker service autoscaling

- **Scale out conditions**:
  - Queue depth > 1.5x baseline for 5m **or** queue lag p95 > 60s for 5m
- **Scale in conditions**:
  - Queue depth < 1.1x baseline and lag p95 < 30s for 20m
- **Guardrails**:
  - Prefer lag-based scaling for bursty queues
  - Keep a minimum worker floor for retry drains

### Validation requirements

Policy is acceptable only if all are true during test:

- Scale-out occurs before hard saturation threshold crossing.
- p95 latency returns below SLO within 10 minutes after scale event.
- No replica thrash (no alternating up/down actions within one cooldown window).

## 5) Failover and chaos scenarios under load

Execute chaos tests while steady-state load is active (not idle).

### Scenario A: node loss

- Inject: terminate one active compute node (API or worker node pool).
- Expected:
  - No prolonged outage (>60s unavailable)
  - Recovery to pre-fault throughput within 10 minutes
  - Error-rate spike limited to short transient window

### Scenario B: dependency slowdown

- Inject: increase downstream DB/redis/external dependency latency by +200ms to +500ms.
- Expected:
  - Circuit breakers/timeouts engage as configured
  - Retries remain bounded
  - p95 increases but recovers below SLO after mitigation or scaling

### Scenario C: retry storm

- Inject: force a subset of calls/jobs to fail with retryable errors for 10–15 minutes.
- Expected:
  - Retry budget/rate limits prevent queue runaway
  - Dead-letter thresholds and backoff policies engage
  - Queue depth recovers to <1.2x baseline within 20 minutes after stop

### Pass/fail criteria for chaos phase

Fail the run if any occurs:

- Cascading dependency failure across unrelated services
- Unbounded retry amplification
- Queue backlog still >1.5x baseline 30 minutes after fault cleared
- SLO breach persists >30 minutes after fault cleared

## 6) Capacity headroom targets

Before release approval, keep headroom above these minimums at forecasted peak (P95 daily peak traffic projection for next release cycle).

- API CPU headroom: **>= 30%**
- DB connection headroom: **>= 25%**
- Queue processing headroom (workers): **>= 30%**
- API latency margin: **p95 <= 80% of SLO threshold**
- Storage IOPS/throughput headroom: **>= 20%**

If any target is missed, create a release-blocking reliability action item with owner and due date.

## 7) Re-test cadence and release gates

### Standard cadence

- Full capacity + chaos validation: monthly
- Incremental load replay (short suite): weekly
- Autoscaling policy drift review: bi-weekly

### Mandatory re-test triggers

Run full validation before release if any of the following occurred since last full run:

- Major release (feature set, schema change, workload pattern shift)
- DB version/config change
- Queue topology/worker concurrency change
- Retry/backoff policy change
- Infrastructure scaling policy change

### Release gate

A major release proceeds only when:

1. Saturation points are documented from current build.
2. Autoscaling policy passed validation requirements.
3. Chaos scenarios passed without unresolved critical findings.
4. Capacity headroom targets are met.

## 8) Run report template

For every full run, publish a report containing:

- Test date, environment, commit SHA, and scenario IDs
- Tenant mix profile and workload mix used
- First saturation point and trigger metric
- Max sustainable throughput before SLO violation
- Autoscaling actions timeline and outcome
- Chaos results per scenario (pass/fail + observations)
- Headroom table vs targets
- Required follow-up actions (owner, due date, priority)

## 9) Execution checklist

- [ ] Tenant-mix profile configured (small/medium/large weights).
- [ ] Workload operation mix configured.
- [ ] Warm-up, steady-state, ramp, recovery stages completed.
- [ ] Saturation metrics captured and first bottleneck identified.
- [ ] Autoscaling policy behavior validated (scale-out/in + anti-thrash).
- [ ] Node-loss, dependency-slowdown, and retry-storm scenarios executed under load.
- [ ] Headroom targets evaluated and recorded.
- [ ] Major-release re-test decision recorded.
- [ ] Report published with action items and owners.

## 10) Published baseline artifact

Use the latest published baseline for release planning and on-call scaling decisions:

- `docs/ops/tenant-capacity-published-baseline.md`
- `docs/ops/reports/tenant-capacity-baseline-2026-04-13.json`
