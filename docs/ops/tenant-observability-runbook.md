# Tenant Observability Runbook

This runbook defines how tenant context is carried into logs, traces, and metrics while minimizing sensitive data exposure, and how to operationalize that data with dashboards, alerts, SLI/SLO policy, and recurring reliability governance.

## 1) Telemetry contract

### Required fields on request logs/metrics

The `structuredErrorLoggingMiddleware` now emits `tenant_metric_http_request` on every response and includes:

- `tenant_id`
- `endpoint_class`
- `status_code`
- `duration_ms`
- `correlation_id`
- `trace_id` / `span_id` (when a W3C `traceparent` header is present)
- `actor_hash` and `ip_hash` pseudonymized fields (never raw actor email or raw IP)
- `plan_code` and `service_tier` labels for tier-aware reliability reporting
- `operation` for SLI-specific classification (`login`, `api-request`, `report-generation`, `webhook-delivery`, `background-job`)

Error logs (`api_response`) and abuse/quota logs also include `tenant_id` and `endpoint_class` for per-tenant drilldowns.

### Sensitive data controls

- Do **not** log raw actor emails.
- Do **not** log raw IP addresses.
- Use `actor_hash` and `ip_hash` for behavioral correlation.
- Keep `tenant_id` visible for tenancy-aware investigations and SLA accountability.

## 2) Required SLIs

All SLIs must be computed per `tenant_id`, `plan_code`, and `service_tier`.

1. **Login success**
   - Source: `tenant_metric_http_request`
   - Selector: `endpoint_class=auth` and `operation=login`
   - Indicator: successful login ratio = `non-5xx logins / total logins`

2. **API latency**
   - Source: `tenant_metric_http_request`
   - Selector: `operation=api-request`
   - Indicator: `p95(duration_ms)`

3. **Report generation latency**
   - Source: `tenant_metric_job_report_generation`
   - Selector: `job_type=report_generation`
   - Indicator: `p95(duration_ms)` from acceptance to report-ready completion

4. **Webhook delivery success**
   - Source: `tenant_metric_webhook_delivery`
   - Selector: terminal statuses (`delivered`, `failed`)
   - Indicator: `delivered / (delivered + failed)`

5. **Background job completion**
   - Source: `tenant_metric_background_job`
   - Selector: terminal statuses (`completed`, `failed`)
   - Indicator: `completed / (completed + failed)`

## 3) SLOs and error budgets by service tier / plan

Use a rolling 30-day window for all objectives.

| Service tier | Plan codes | Login success SLO (budget) | API latency SLO (budget) | Report generation latency SLO (budget) | Webhook delivery success SLO (budget) | Background job completion SLO (budget) |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | `starter` | 99.5% (0.5%) | 95% <= 900ms (5% slower) | 95% <= 120s (5% slower) | 99.0% (1.0%) | 99.0% (1.0%) |
| Growth | `growth`, `pro` | 99.9% (0.1%) | 95% <= 600ms (5% slower) | 95% <= 60s (5% slower) | 99.5% (0.5%) | 99.5% (0.5%) |
| Enterprise | `enterprise` | 99.95% (0.05%) | 95% <= 400ms (5% slower) | 95% <= 30s (5% slower) | 99.9% (0.1%) | 99.9% (0.1%) |

## 4) Alert routing tied to error budget burn

Configure multi-window, multi-burn-rate alerting on each tier/SLI pair.

### Fast-burn alerts (critical)

- Burn-rate condition: `burn_rate_1h >= 4` **and** `burn_rate_6h >= 2`
- Routing:
  - `reliability-pager`
  - `oncall-primary`
- Response target: acknowledge within 15 minutes
- Escalation: open incident if condition persists 30 minutes or budget remaining <= 30%

### Slow-burn alerts (high)

- Burn-rate condition: `burn_rate_6h >= 1` **and** `burn_rate_3d >= 1`
- Routing:
  - `reliability-triage`
  - `service-owner`
- Response target: triage within 4 hours
- Escalation: reliability improvement ticket required if sustained for 24h or budget remaining <= 50%

### Existing security/leakage alerts (unchanged)

Keep the leakage and abuse alert routing from this runbook and the observability spec.

## 5) Dashboards

Build a **Tenant Health** dashboard with these panels.

### A. Per-tenant latency

Source: `tenant_metric_http_request`

Suggested queries:

- P50 latency by tenant (`duration_ms`, grouped by `tenant_id`)
- P95 latency by tenant and `endpoint_class`
- P95 API latency by tier (`operation=api-request`)
- P99 report generation latency (`operation=report-generation`)

### B. Per-tenant error rates and budget health

Sources: `tenant_metric_http_request`, `tenant_metric_webhook_delivery`, `api_response`

Suggested queries:

- Login success ratio by service tier
- Webhook delivery success ratio by tenant
- Error budget remaining by tier and SLI

### C. Queue lag and jobs

Source options:

- Existing queue/job telemetry (if available)
- Fallback: ingest `tenant_queue_lag_ms`, `tenant_queue_depth`, and `tenant_metric_background_job`

Suggested panels:

- Current lag by tenant and queue name
- P95 queue lag by tenant
- Background job completion ratio by queue
- Queue depth by tenant

### D. Usage saturation

Sources: quota/throttle events in middleware

Suggested panels:

- Soft quota utilization: `usage_count / soft_quota` by tenant + endpoint class
- Hard quota approach: `usage_count / hard_quota`
- Throttle reject counts (`429`) by tenant and endpoint class

## 6) Weekly reliability review ritual

Run a standing **Weekly Reliability Review** with action tracking.

### Cadence and attendees

- Cadence: weekly (30–45 minutes)
- Required attendees:
  - SRE on-call
  - Product engineering owner
  - Service owner(s)
  - Support representative

### Agenda

1. Review last week's SLI/SLO performance by tier and top impacted tenants.
2. Review all fast-burn and slow-burn alerts and incident timelines.
3. Review new and existing error-budget violations.
4. Decide launch guards or change freezes for services with exhausted budgets.
5. Confirm owners and due dates for mitigation actions.

### Action tracking requirements

Track follow-up items in `reliability-action-log` (or equivalent system of record).

Required fields for each action item:

- owner
- due date
- linked service
- linked tier
- mitigation type (bug fix, scaling, retry tuning, dependency remediation, etc.)
- status

Policy:

- Any service/tier over budget must have an action item created within 1 business day.
- Open action items are reviewed every weekly meeting until closure.
- Repeat budget violations for 2 consecutive weeks require director-level review.

## 7) Implementation checklist

- [ ] Confirm ingestion of `tenant_metric_http_request`, `tenant_metric_job_report_generation`, `tenant_metric_webhook_delivery`, and `tenant_metric_background_job`.
- [ ] Verify all SLI streams include `tenant_id`, `plan_code`, and `service_tier` labels.
- [ ] Build Tenant Health dashboard with the required sections and budget panels.
- [ ] Wire fast-burn and slow-burn routing to on-call and reliability channels.
- [ ] Add SLO calculators grouped by `tenant_id`, `service_tier`, and `sli_id`.
- [ ] Create and publish the recurring Weekly Reliability Review calendar invite.
- [ ] Ensure every budget violation has tracked remediation actions with owners and due dates.
- [ ] Review telemetry payloads quarterly for PII regressions.
