# Tenant Observability Runbook

This runbook defines how tenant context is carried into logs, traces, and metrics while minimizing sensitive data exposure, and how to operationalize that data with dashboards, alerts, and SLOs.

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

Error logs (`api_response`) and abuse/quota logs also include `tenant_id` and `endpoint_class` for per-tenant drilldowns.

### Sensitive data controls

- Do **not** log raw actor emails.
- Do **not** log raw IP addresses.
- Use `actor_hash` and `ip_hash` for behavioral correlation.
- Keep `tenant_id` visible for tenancy-aware investigations and SLA accountability.

## 2) Dashboards

Build a **Tenant Health** dashboard with these panels.

### A. Per-tenant latency

Source: `tenant_metric_http_request`

Suggested queries:

- P50 latency by tenant (`duration_ms`, grouped by `tenant_id`)
- P95 latency by tenant and `endpoint_class`
- P99 latency for reporting endpoints (`endpoint_class=reporting`)

### B. Per-tenant error rates

Sources: `tenant_metric_http_request`, `tenant_abuse_high_error_rate`, `api_response`

Suggested queries:

- Error rate (%) by tenant over 5m/15m (`status_code >= 400` / total)
- 5xx error rate by tenant
- Top tenants by absolute errored request volume

### C. Queue lag

Source options:

- Existing queue/job telemetry (if available)
- Fallback: ingest custom `tenant_queue_lag_ms` metric from workers/subscribers

Suggested panels:

- Current lag by tenant and queue name
- P95 queue lag by tenant
- Queue depth by tenant (if queue system exports depth)

### D. Usage saturation

Sources: quota/throttle events in middleware

Suggested panels:

- Soft quota utilization: `usage_count / soft_quota` by tenant + endpoint class
- Hard quota approach: `usage_count / hard_quota`
- Throttle reject counts (`429`) by tenant and endpoint class

## 3) Leakage indicator alerts

Configure alerts using these log events:

1. `tenant_leakage_auth_mismatch`
   - Trigger: any event in 5 minutes
   - Meaning: request tenant context did not match tenant embedded in auth context.

2. `tenant_leakage_cross_tenant_pattern`
   - Trigger: >= 3 events for the same `actor_hash` in 10 minutes
   - Meaning: suspicious rapid cross-tenant switching pattern for one actor identity.

3. `tenant_abuse_high_error_rate`
   - Trigger: error rate >= 35% with at least 20 requests in the rolling window
   - Meaning: potential abuse or integration fault that can mask leakage/fuzzing behavior.

4. `tenant_abuse_sudden_spike`
   - Trigger: any event, page on-call if repeated
   - Meaning: sudden anomalous request volume growth for a tenant class.

## 4) SLOs for core tenant operations

Define SLOs with tenant as a required dimension.

### Login (`endpoint_class=auth`)

- **Availability SLO:** 99.9% successful responses (non-5xx) per rolling 30 days
- **Latency SLO:** 95% of requests under 400ms

### Create/Update operations (`endpoint_class=write-heavy`)

- **Availability SLO:** 99.5% non-5xx per rolling 30 days
- **Latency SLO:** 95% under 800ms

### Reporting (`endpoint_class=reporting`)

- **Availability SLO:** 99.0% non-5xx per rolling 30 days
- **Latency SLO:** 95% under 2000ms, 99% under 5000ms

### Error budget policy

- Page primary on-call when a tenant burns > 20% of monthly budget in 24h.
- Trigger incident response when burn rate exceeds 2x for 1h and 6h windows.

## 5) Implementation checklist

- [ ] Confirm ingestion of `tenant_metric_http_request` and leakage events in log pipeline.
- [ ] Build Tenant Health dashboard with the four required sections.
- [ ] Wire alerts to incident channel with severity routing.
- [ ] Add SLO calculators grouped by `tenant_id` and `endpoint_class`.
- [ ] Review telemetry payloads quarterly for PII regressions.
