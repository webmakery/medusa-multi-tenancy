# Release Governance Runbook (Tenant-Scoped Flags + Safe Rollouts)

## Scope

This runbook defines how to execute tenant-scoped feature rollouts with canary/blue-green strategies, enforce pre-release quality gates, and report DORA metrics.

## 1. Tenant-scoped feature flags

Feature flags are provided by `TENANT_FEATURE_FLAGS` as JSON and evaluated by `src/modules/tenant-context/feature-flags.ts`.

Example:

```json
{
  "checkout_v2": {
    "default_enabled": false,
    "strategy": "canary",
    "canary_percentage": 5,
    "tenants": {
      "tenant-a": { "enabled": true, "strategy": "canary", "canary_percentage": 25 },
      "tenant-b": { "enabled": true, "strategy": "blue-green", "blue_environment": "green" }
    }
  }
}
```

## 2. Pre-release quality gates

Run quality gates before every production deployment:

```bash
yarn release:quality-gate
```

Default gates:
- unit tests
- integration HTTP tests
- migration drift/check command
- security control scan

If your environment needs different checks, override with:

```bash
yarn release:quality-gate --commands="yarn test:unit,yarn security:validate-controls"
```

## 3. Canary / Blue-Green rollout with automated rollback

Use the release orchestrator for progressive delivery and SLO guardrails:

```bash
RELEASE_STRATEGY=canary \
RELEASE_DEPLOY_COMMAND="./deploy.sh" \
RELEASE_ROLLBACK_COMMAND="./rollback.sh" \
CURRENT_ERROR_RATE=0.012 \
SLO_MAX_ERROR_RATE=0.02 \
CURRENT_P95_LATENCY_MS=420 \
SLO_MAX_P95_LATENCY_MS=500 \
CURRENT_AVAILABILITY=0.998 \
SLO_MIN_AVAILABILITY=0.995 \
yarn release:orchestrate
```

Rollback is automatically triggered when one of the following breaches:
- error rate > max error rate SLO
- p95 latency > max p95 latency SLO
- availability < min availability SLO

## 4. DORA metrics tracking

Prepare deployment/incident events in a JSON file and compute summary metrics:

```bash
yarn dora:metrics --input=./artifacts/dora-events.json --lookback_days=30
```

Output includes:
- deployment frequency (deployments/day)
- change failure rate (%)
- MTTR (hours)

## 5. Operational checklist

- [ ] Feature flag tenant overrides reviewed by service owner.
- [ ] Quality gate passed on release commit.
- [ ] Rollout strategy selected (`canary` or `blue-green`).
- [ ] SLO thresholds defined for error rate, p95 latency, and availability.
- [ ] Automated rollback command validated.
- [ ] DORA metrics report generated after release window.
