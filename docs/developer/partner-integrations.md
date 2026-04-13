# Partner Integration Guide and Reference Implementations

This guide provides implementation references for common partner patterns using the platform integration framework.

## Supported baseline capabilities

All partner integrations should implement:
- API version pinning
- webhook signature verification
- idempotent processing
- retry with backoff
- dead-letter routing for terminal failures

## Reference implementations

- `examples/partner-integrations/stripe-webhook-handler.ts`
- `examples/partner-integrations/shopify-webhook-handler.ts`
- `examples/partner-integrations/klaviyo-event-forwarder.ts`

## 1) Stripe webhook handler reference

Use this when handling payment and refund webhooks.

Highlights:
- validates timestamped signature
- deduplicates event IDs
- routes failures to dead-letter after retry budget

## 2) Shopify webhook handler reference

Use this for order/product/customer topic ingestion.

Highlights:
- validates `x-shopify-hmac-sha256`
- scopes replay keys by tenant and topic
- records deterministic idempotency keys (`topic + event-id`)

## 3) Klaviyo event forwarder reference

Use this for outbound profile/event synchronization.

Highlights:
- outbound retries on `429` and `5xx`
- per-tenant API key isolation
- dead-letter payload capture with retry metadata

## Integration readiness checklist

Before moving to production:
- verify tenant-scoped credentials and rotation path
- verify retry and dead-letter metrics
- verify replay protection and idempotency under load
- verify migration plan for API version upgrades
- verify partner runbook and on-call escalation path
