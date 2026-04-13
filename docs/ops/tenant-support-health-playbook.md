# Tenant support + health operations playbook

## Objective
Standardize tenant support operations so support, success, and revops teams can:
- resolve the most common tenant issues using known-good workflows,
- meet plan-based SLA commitments,
- prioritize queues by business impact,
- quantify tenant health with a consistent score,
- and proactively intervene for high-value tenants before churn risk materializes.

---

## 1) Support playbooks for top tenant issues

Use these playbooks for all inbound tickets tagged `tenant-support`.

### 1.1 Playbook index

| Issue category | Trigger signals | First response target | Owning team | Known-good resolution path |
| --- | --- | --- | --- | --- |
| Login + access lockout | Repeated 401/403, owner/admin cannot access admin | See SLA matrix below | Support + Identity | Verify identity -> validate membership + role -> reset invite/session -> confirm access restored |
| Checkout/payment failures | Spike in failed payments, gateway timeouts, checkout complaints | See SLA matrix below | Support + Payments | Capture failing order + correlation ID -> verify payment provider health -> retry via approved workflow -> confirm order state |
| App/webhook delivery failures | App install active but webhook errors or retries > threshold | See SLA matrix below | Support + Platform | Validate endpoint + secret -> replay failed deliveries -> verify 2xx acknowledgments and queue drain |
| Catalog/inventory sync drift | Stock mismatch between storefront and admin, stale quantity | See SLA matrix below | Support + Operations | Validate source of truth -> run targeted re-sync workflow -> confirm inventory parity |
| Billing state degradation | `past_due`, `grace_period`, `suspended` transitions | See SLA matrix below | Support + RevOps | Confirm invoice/payment method status -> execute dunning recovery sequence -> restore entitlements |

### 1.2 Known-good workflows by issue

#### A. Login + access lockout
1. Confirm tenant + requester identity (ticket email must match authorized member domain or verified ownership record).
2. Inspect tenant membership and role assignment.
3. If invite is stale/pending, resend invite and invalidate prior token.
4. If session corruption is suspected, revoke active sessions and request fresh login.
5. Validate recovery with customer (screen share or explicit confirmation).
6. Close ticket only after successful admin access is confirmed.

Exit criteria:
- Tenant owner/admin can access admin dashboard.
- Membership + role integrity validated.
- Audit note includes root cause (`expired_invite`, `removed_membership`, `session_invalid`, etc.).

#### B. Checkout/payment failures
1. Collect order/cart ID, tenant ID, payment provider, and timestamp.
2. Check for provider outage/degraded status and error class (hard decline vs transient).
3. Reproduce using a non-production test path when safe.
4. Execute approved remediation:
   - transient gateway timeout -> controlled retry,
   - capture authorization drift -> re-authorize + reconcile,
   - webhook confirmation lag -> replay provider webhook.
5. Verify final state (`authorized`/`captured`/`refunded`) is consistent across admin and provider.
6. Document customer-visible impact and follow-up prevention action.

Exit criteria:
- Impacted transaction path validated as recovered.
- No orphaned payment intents/authorizations.
- Customer communication sent with resolution summary.

#### C. App/webhook delivery failures
1. Confirm app installation state and secret rotation history.
2. Validate endpoint DNS/TLS, response codes, and timeout behavior.
3. Replay failed deliveries from delivery log in chronological order.
4. If endpoint rejects signatures, rotate secret and retest with signed sample payload.
5. Observe retry queue until failure rate returns to baseline.
6. Close only after successful deliveries are observed for at least two consecutive events.

Exit criteria:
- Webhook success ratio restored to normal baseline.
- Retry backlog cleared or within accepted queue threshold.
- Secret and endpoint state documented.

#### D. Catalog/inventory sync drift
1. Confirm authoritative inventory source for tenant (WMS/ERP/admin).
2. Identify impacted SKUs/locations and drift magnitude.
3. Run targeted sync workflow for affected scope.
4. Recalculate availability and republish inventory projections if required.
5. Validate storefront vs admin parity on sampled SKUs.
6. File product gap if recurring source conflict is detected.

Exit criteria:
- Inventory parity restored for affected SKUs.
- Drift cause recorded (`missed_event`, `integration_lag`, `manual_override_conflict`).
- Preventive follow-up assigned.

#### E. Billing state degradation
1. Confirm current billing state and recent invoice outcomes.
2. Classify issue (expired card, insufficient funds, processor decline, invoice mismatch).
3. Trigger appropriate recovery motion:
   - self-serve payment update reminder,
   - assisted payment recovery call,
   - temporary grace extension (policy-gated).
4. Re-run entitlement sync after successful collection.
5. Verify tenant plan access is restored and suspension guards removed.
6. Send confirmation + next invoice expectations.

Exit criteria:
- Billing state returns to `active` or explicitly approved exception state.
- Entitlements align to paid plan.
- Recovery timeline captured for churn analysis.

---

## 2) SLA targets by plan + queue triage by business impact

### 2.1 SLA matrix by subscription plan

All clocks run in business hours except Priority/Urgent targets for Enterprise.

| Plan | Priority | Initial response SLA | First meaningful action SLA | Resolution target |
| --- | --- | --- | --- | --- |
| Enterprise | Urgent (revenue blocked / outage) | 15 minutes | 30 minutes | 4 hours or workaround in 2 hours |
| Enterprise | High (critical workflow degraded) | 30 minutes | 1 hour | 8 hours |
| Enterprise | Normal | 2 hours | 4 hours | 2 business days |
| Growth | High | 1 hour | 2 hours | 1 business day |
| Growth | Normal | 4 hours | 8 hours | 3 business days |
| Growth | Low | 1 business day | 2 business days | 5 business days |
| Starter | Normal | 1 business day | 2 business days | 5 business days |
| Starter | Low | 2 business days | 3 business days | 7 business days |

### 2.2 Queue triage policy by business impact

Assign each new ticket an `impact_tier` using the highest matched condition.

| Impact tier | Conditions | Queue | Escalation path |
| --- | --- | --- | --- |
| Tier 0 (Critical) | Revenue blocked for high-value tenant; tenant-wide outage; security/access breach risk | `support-critical` | Immediate pager to on-call + support lead + account owner |
| Tier 1 (Major) | Core workflow blocked for multiple users or high-value tenant with no workaround | `support-priority` | Escalate to specialist pod in <= 30 min |
| Tier 2 (Standard) | Single workflow degraded; workaround exists; moderate ARR exposure | `support-standard` | Triage in normal rotation |
| Tier 3 (Low) | Cosmetic issue, question, or low-risk config support | `support-backlog` | Batch handling + async guidance |

Business impact scoring inputs (for queue placement):
- Tenant annualized revenue band (ARR tier).
- Number of affected users/orders.
- Workflow criticality (checkout, payment, fulfillment, admin-only).
- Time sensitivity (campaign launch, peak period, contract milestone).
- Presence/absence of workaround.

Routing rule:
`impact_tier = max(revenue_impact, workflow_impact, security_impact)` where security impact always floors at Tier 1.

---

## 3) Tenant health score model

Health score range: **0-100**. Recompute hourly for top-tier tenants and daily for all others.

### 3.1 Weighted model

| Component | Weight | Definition |
| --- | --- | --- |
| Product usage | 35% | Activation + sustained usage vs tenant baseline and plan cohort |
| Reliability/errors | 25% | Error rate, failed jobs, degraded API availability, incident adjacency |
| Support volume + sentiment | 20% | Ticket volume trend, reopen rate, severe ticket ratio, CSAT sentiment |
| Payment state | 20% | Billing status, failed attempts, grace/suspension risk, recovery velocity |

`health_score = usage_score*0.35 + reliability_score*0.25 + support_score*0.20 + payment_score*0.20`

### 3.2 Component scoring logic

#### Usage score (0-100)
- 100: >= 110% of expected weekly active usage and key workflow completion on target.
- 70: 80-109% of expected usage.
- 40: 50-79% of expected usage or onboarding checkpoints slipping.
- 10: < 50% of expected usage over rolling 14 days.

#### Reliability score (0-100)
- Start at 100, then apply deductions:
  - `-25` for elevated error-rate breach lasting > 30 min.
  - `-20` for unresolved SEV2-equivalent tenant incident.
  - `-10` for repeated webhook/job failures beyond threshold.
  - Floor at 0.

#### Support score (0-100)
- Start at 100, then apply deductions:
  - `-15` if ticket volume > 2x trailing 30-day baseline.
  - `-20` if reopen rate > 20%.
  - `-15` if >= 2 high-priority tickets open > SLA.
  - `-10` if CSAT trend declines below threshold.

#### Payment score (0-100)
- `100` for active + no failed attempts in rolling 30 days.
- `70` for active with 1-2 failed attempts recovered <= 3 days.
- `40` for `past_due` or repeated failed attempts.
- `10` for `grace_period`.
- `0` for `suspended`.

### 3.3 Health tiers

| Tier | Score range | Meaning |
| --- | --- | --- |
| Green | 80-100 | Stable, no intervention needed |
| Yellow | 60-79 | Early risk; monitor and engage if trend worsens |
| Orange | 40-59 | Material risk; success outreach required |
| Red | 0-39 | Acute churn/revenue risk; immediate intervention |

---

## 4) Proactive outreach for at-risk high-value tenants

### 4.1 Trigger criteria

Create an outreach task when **all** are true:
1. Tenant value tier is `high-value` (Enterprise or top ARR decile).
2. Health tier is `Orange` or `Red`, **or** score drops >= 15 points within 7 days.
3. At least one risk driver is currently active (`usage_drop`, `error_spike`, `support_burst`, `payment_risk`).

### 4.2 Outreach SLA + sequence

| Step | Owner | Deadline from trigger | Action |
| --- | --- | --- | --- |
| 1 | CSM / Account owner | <= 4 business hours | Personalized outreach summarizing observed risk + meeting offer |
| 2 | Support lead | <= 1 business day | Prepare issue brief with open incidents/tickets and mitigation options |
| 3 | Joint Success + Support review | <= 2 business days | Confirm 14-day stabilization plan with named actions and dates |
| 4 | Executive checkpoint (if Red persists) | <= 5 business days | Escalate to leadership with recovery plan and commercial risk assessment |

### 4.3 Standard outreach package

Each outreach package must include:
- Current health score + 30-day trend.
- Top 3 risk drivers with evidence.
- Immediate mitigations already applied.
- Remaining blockers needing customer action.
- Date and owner for next checkpoint.

### 4.4 Exit conditions for proactive motion

Close outreach motion when all are true for 14 consecutive days:
- Health score >= 70.
- No open Tier 0/Tier 1 support tickets.
- Payment state is not `past_due`, `grace_period`, or `suspended`.
- Usage trajectory is flat-to-positive vs expected baseline.

---

## 5) Operating cadence + governance

- Daily: queue triage standup with support lead (15 min).
- Weekly: at-risk tenant review with support + success + revops.
- Monthly: SLA compliance and health-model calibration review.

Track these program KPIs:
- SLA attainment by plan and priority.
- Mean time to first meaningful action.
- % high-value tenants in Orange/Red.
- Recovery rate for proactive outreach motions.
- 30/60-day churn outcome for proactively managed tenants.
