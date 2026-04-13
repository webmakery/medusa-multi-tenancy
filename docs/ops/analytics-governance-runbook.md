# Analytics governance runbook

## 1) Event taxonomy and tenant-safe payload rules

The canonical analytics event taxonomy is defined in `docs/ops/analytics-governance-spec.yaml`.

Implementation requirements:

1. Every analytics event must include `tenant_id`, `event_type`, and `event_timestamp`.
2. Metadata is allow-listed by event type (`channel`, `campaign`, `actor_hash`).
3. Suspicious PII keys are dropped at ingestion time.
4. Raw events are persisted as tenant-scoped records only.

## 2) Pipeline validation for duplication, loss, and late arrival

Use the automated validator to detect anomalies before and after releases.

```bash
npm run analytics:validate-pipeline
```

What is validated:

- Duplicate rows in `analytics_event` over a configurable lookback window.
- Loss/drift between raw `checkout_completed` events and `analytics_rollup_daily.checkout_completed_count`.
- Late-arriving rows where `created_at - event_timestamp > 24h`.

Optional threshold overrides:

```bash
node scripts/validate-analytics-pipeline.js \
  --lookback_hours=72 \
  --duplicate_threshold_pct=0.10 \
  --loss_threshold_pct=0.20 \
  --late_threshold_pct=1.00
```

## 3) Retention and automated expiry/deletion

Retention is enforced by the scheduled job `analytics-retention-job`:

- `analytics_event`: keep 30 days of processed raw rows.
- `analytics_rollup_daily`: keep 400 days.
- `analytics_top_product_daily`: keep 400 days.

Schedule: `19 2 * * *` (daily at 02:19 UTC).

## 4) Data quality monitors and metric ownership

The monitor catalog and ownership mapping are defined in `docs/ops/analytics-governance-spec.yaml`.

Core monitor set:

- Duplicate event rate
- Rollup loss rate
- Late-arrival share
- Metric freshness

Core business metric ownership:

- `gmv_cents`: Finance + Analytics Engineering
- `orders_count`: Commerce Ops + Analytics Engineering
- `conversion_proxy`: Growth + Analytics Engineering
- `sessions_count`: Growth + Data Platform
