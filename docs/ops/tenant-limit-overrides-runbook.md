# Tenant Request Limit Temporary Override Runbook

## Purpose

Use this runbook when support or SRE needs a **time-bound** request limit override for a specific tenant and endpoint class:

- `auth`
- `write-heavy`
- `reporting`
- `api-exports`

Overrides apply to:

- per-minute throttles
- per-hour soft/hard usage quotas
- overage grace requests

> Default behavior remains the global tenant protection policy. Overrides are emergency exceptions and must be removed after incident resolution.

## Prerequisites

1. Incident or support ticket with tenant identifier and business justification.
2. Explicit expiration timestamp (UTC).
3. Approval from on-call engineering owner.

## Signals to check before override

1. Confirm whether limits were exceeded from API logs:
   - `tenant_usage_alert_threshold_reached`
   - `tenant_abuse_sudden_spike`
   - `tenant_abuse_high_error_rate`
2. Confirm this is not malicious traffic (credential stuffing, runaway integration, export scraping).
3. Confirm tenant-specific reason (planned bulk import/export, temporary migration, controlled launch).

If abuse is suspected, do **not** raise limits; escalate to security incident response.

## Override mechanism

The API reads a JSON object from `TENANT_LIMIT_OVERRIDES` at process startup.

### JSON schema

```json
{
  "<tenant_id>": {
    "auth": {
      "throttlePerMinute": 120,
      "softQuotaPerHour": 1200,
      "hardQuotaPerHour": 1500,
      "overageGraceRequests": 50
    },
    "write-heavy": {
      "throttlePerMinute": 250,
      "softQuotaPerHour": 3000,
      "hardQuotaPerHour": 3600,
      "overageGraceRequests": 200
    },
    "reporting": {
      "throttlePerMinute": 140,
      "softQuotaPerHour": 1200,
      "hardQuotaPerHour": 1500,
      "overageGraceRequests": 100
    },
    "api-exports": {
      "throttlePerMinute": 40,
      "softQuotaPerHour": 250,
      "hardQuotaPerHour": 320,
      "overageGraceRequests": 25
    }
  }
}
```

All values are optional. Only specified fields/classes are overridden.

## Execution steps

1. Build override JSON for the exact tenant and endpoint class.
2. Update deployment configuration for `TENANT_LIMIT_OVERRIDES`.
3. Roll restart API pods/instances so the override is loaded.
4. Validate with controlled requests from the affected tenant:
   - confirm no immediate 429 while below override values
   - confirm `x-usage-quota-state` headers if soft/hard overage applies
5. Post ticket update with:
   - applied values
   - start time
   - expiry time
   - owner

## Monitoring during override

Monitor every 5–10 minutes:

- 429 rate per tenant/class
- error rate for tenant/class
- sudden spike alerts
- downstream dependencies (DB latency, queue depth, worker failures)

If platform risk increases, roll back override immediately.

## Rollback / expiry

1. Remove tenant override entry from `TENANT_LIMIT_OVERRIDES`.
2. Restart API processes.
3. Confirm tenant returns to default limits.
4. Add final incident note with:
   - total override duration
   - traffic behavior observed
   - follow-up actions (plan upgrade, integration fixes, export scheduling)

## Guardrails

- Do not issue open-ended overrides.
- Prefer smallest viable increase for shortest time window.
- Avoid increasing `auth` unless verified legitimate authentication surge.
- Repeated override requests from same tenant require product/engineering review.
