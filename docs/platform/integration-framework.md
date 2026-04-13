# Integration Framework (Webhooks, Security, Reliability)

## Objectives

The integration framework standardizes outbound and inbound partner flows with:
- signed webhook delivery
- retry and dead-letter behavior
- replay protection
- tenant-scoped observability and incident response

## Outbound event delivery contract

### Delivery pipeline

1. Domain event emitted (for example `order.created`).
2. Active tenant-scoped subscriptions resolved.
3. Payload signed with active app credential secret.
4. Delivery attempted with retry policy.
5. Attempts logged in `app_webhook_delivery_log`.
6. Exhausted deliveries moved to tenant-scoped dead-letter state.

### Required headers

Outbound webhook requests include:
- `x-app-id`
- `x-app-key`
- `x-app-signature` (`sha256=<hex>`)
- `x-tenant-id`

### Retry policy

- Maximum attempts: **3 delivery attempts** before dead-letter.
- Retry conditions: network errors or non-2xx responses.
- Each attempt is durably logged with status and response code.

### Dead-letter behavior

If all retries fail:
- create terminal delivery log entry with `delivery_status=dead_letter`
- preserve last failure reason and response code
- expose failed attempts in admin diagnostics for replay tooling

## Inbound webhook verification contract

### Required inbound headers

Inbound calls must include:
- `x-app-signature`
- `x-app-nonce`
- `x-app-timestamp`

### Signature validation

- Verify HMAC SHA-256 against raw payload and active secret.
- Use constant-time comparison.
- Reject invalid signatures with `401`.

### Replay protection

- Nonce + app + tenant composite key tracked for a bounded TTL.
- Duplicate nonce within TTL rejected with `409`.
- Timestamp skew validated against accepted clock window.

### Audit logging

Failed verification events are captured with failure reason, path, and payload fingerprint for investigation.

## Operational controls

- tenant-scoped dashboard for delivery success/failure rate
- alerts on repeated dead-letter growth
- runbook-driven replay from failed delivery logs
- secret rotation with immediate activation of new key ID and secret pair

## Implementation boundaries

- Integrations are tenant-isolated by data model and query filters.
- Framework primitives are shared; partner adapters are composition-only.
- New partner connectors must adopt the same signature, retry, and audit conventions.
