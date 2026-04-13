# Tenant Capacity Baseline (Published)

_Date: 2026-04-13_

This document publishes the active-tenant assumptions, staged load-test outcomes, bottlenecks, and release-safe capacity envelope.

## 1) Expected active tenants, peak concurrency, and request mix

### Tenant and user assumptions

- **Expected active tenants in peak window:** **420**
- **Expected peak concurrent users (admin + store):** **2,400**
- **Peak throughput target for validation:** **1,200 requests/sec (RPS)**

### Tenant cohort mix used for validation

- **Small tenants:** 85% of tenants / 40% of requests
- **Medium tenants:** 12% of tenants / 35% of requests
- **Large tenants:** 3% of tenants / 25% of requests

### Request mix used for validation

- Auth/login: **5%**
- Read API: **45%**
- Write API: **20%**
- Reporting: **10%**
- Webhooks: **10%**
- Background jobs: **10%**

## 2) Staged load test results and bottlenecks

Stages executed: warm-up (50%), steady-state (100%), ramp (+10% steps), and recovery (70%).

### Summary table

| Stage | Target RPS | CPU | DB Pool | DB Wait p95 | Queue Lag p95 | API p95 | Outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| Warm-up | 600 | 47.0% | 55.0% | 8 ms | 20 s | 180 ms | Pass |
| Steady-state | 1,200 | 66.0% | 76.0% | 22 ms | 38 s | 285 ms | Pass |
| Ramp +10% | 1,320 | 72.8% | 86.2% | 37 ms | 74 s | 327 ms | **First saturation** |
| Ramp +20% | 1,440 | 79.6% | 96.4% | 51 ms | 110 s | 369 ms | Saturated |
| Ramp +30% | 1,560 | 86.4% | 98.0% | 66 ms | 146 s | 411 ms | Saturated |
| Ramp +40% | 1,680 | 93.2% | 98.0% | 80 ms | 182 s | 453 ms | Saturated |
| Recovery | 840 | 54.6% | 63.4% | 8 ms | 20 s | 180 ms | Recovered |

### Bottlenecks identified

1. **Primary bottleneck:** Database connection pressure appears first at **1,320 RPS** (DB pool 86.2%).
2. **Secondary bottlenecks:** Compute saturation at **1,440 RPS**, then queue lag pressure at **1,560 RPS**.
3. **User-visible pressure:** API latency saturation begins at **1,680 RPS**.

## 3) Published capacity numbers, safety margin, and scaling triggers

### Published capacity

- **Measured max sustainable throughput before first saturation:** **1,200 RPS**
- **Published capacity (with 25% safety margin):** **900 RPS**
- **Safety margin policy:** maintain at least **25% headroom** for release planning and incident absorption.

### Scaling triggers (publish and operationalize)

#### API scale-out trigger

Scale API pods when either condition holds for 5 minutes:

- CPU >= 60% **and** API p95 >= 320 ms, **or**
- In-flight request concurrency >= 75% of safe per-pod concurrency.

#### Worker scale-out trigger

Scale worker pods when either condition holds for 5 minutes:

- Queue lag p95 >= 60 seconds, **or**
- Queue depth >= 1.5x baseline.

#### Database protection trigger

Initiate DB protection actions (pool tuning, query-shed, read routing, vertical scale prep) when either condition holds for 5 minutes:

- DB pool usage >= 75%, **or**
- DB wait p95 >= 35 ms.

## 4) Release guardrail

Do not approve major release rollout if forecast peak exceeds **900 RPS** unless one of the following is complete:

1. Capacity uplift validated in staged re-run, or
2. Feature-flag rollout with tenant canary limits and auto-rollback thresholds.

## 5) Evidence

- Raw staged run report: `docs/ops/reports/tenant-capacity-baseline-2026-04-13.json`
- Model execution command:

```bash
node scripts/capacity-model-load-test.js > docs/ops/reports/tenant-capacity-baseline-2026-04-13.json
```
