# KPI operating model (reliability, growth, efficiency)

## 1) KPI pack (definitions, formulas, targets, ownership)

| KPI | Category | Definition | Formula | Measurement cadence | Target (quarterly) | Data source (system of record) | Business owner | Technical owner |
|---|---|---|---|---|---|---|---|---|
| Monthly Recurring Revenue (MRR) | Growth | Normalized recurring subscription revenue recognized in the month, excluding one-time services and credits. | `SUM(active_subscription_monthly_value)` | Daily snapshot, month-end close | >= 8% QoQ growth | Billing ledger + subscription plans (`tenant_billing_account`, invoice system export) | RevOps | Data Platform |
| Annual Recurring Revenue (ARR) | Growth | Annualized recurring subscription revenue run-rate. | `MRR * 12` | Daily | >= 25% YoY run-rate growth | Derived from MRR model (same SoT) | Finance | Analytics Engineering |
| Gross Revenue Retention (Retention) | Growth | Percentage of starting-period recurring revenue retained after churn and contraction, excluding expansion. | `(Starting MRR - Churn MRR - Contraction MRR) / Starting MRR` | Weekly + month-end | >= 92% monthly | Billing ledger + cancellation/contraction events | Customer Success | RevOps Analytics |
| Net Revenue Retention (NRR) | Growth | Revenue retained from existing tenants including expansion, contraction, and churn. | `(Starting MRR + Expansion MRR - Contraction MRR - Churn MRR) / Starting MRR` | Weekly + month-end | >= 110% monthly | Billing ledger + entitlement change events | Growth | RevOps Analytics |
| Uptime (Availability) | Reliability | Percentage of successful availability checks for customer-facing admin + API services. | `(Total checks - failed checks) / total checks` | 5-minute rollup, monthly report | >= 99.95% monthly | Observability SLI metrics (`tenant-observability-spec`) | SRE | Platform Engineering |
| API p95 latency | Reliability | 95th percentile request duration for tier-1 API routes. | `P95(duration_ms)` grouped by endpoint class/tier | 5-minute rollup, weekly trend | <= 350 ms p95 | OpenTelemetry traces + API metrics | Platform Engineering | SRE |
| Support SLA attainment | Reliability | Share of support tickets that meet initial response and first meaningful action SLA by plan/priority. | `Tickets within SLA / total SLA-eligible tickets` | Daily + weekly support review | >= 95% by plan tier | Ticketing platform export + support health model | Support | Support Operations |
| Gross margin | Efficiency | Percentage of revenue remaining after direct COGS (infrastructure, external APIs, payment variable costs). | `(Revenue - Direct COGS) / Revenue` | Weekly snapshot + monthly close | >= 68% blended margin | FinOps warehouse model + cost allocation views | Finance | FinOps |

### KPI policy guardrails

- KPI definitions are versioned and changes require Finance + Data Platform approval.
- Any KPI formula changes require backfill impact analysis before go-live.
- Target changes are allowed only in quarterly planning windows.

## 2) Automated dashboard extraction + single source of truth (SoT)

### Extraction automation workflow

1. **Ingest** source data from billing, observability, support, and cost systems into curated warehouse tables on an hourly schedule.
2. **Transform** data using versioned models (`kpi_fact_daily`, `kpi_fact_weekly`, `kpi_fact_monthly`) with deterministic tests for freshness and referential integrity.
3. **Publish** dashboard extracts to a governed dataset (`ops_kpi_snapshot`) consumed by the admin KPI dashboard and executive reports.
4. **Validate** every run with quality checks:
   - no null keys for `tenant_id`, `metric_date`, `kpi_id`
   - freshness threshold < 90 minutes for reliability metrics
   - reconciliation tolerance <= 0.5% versus source ledgers
5. **Alert** owners on extraction failures via PagerDuty + Slack with runbook links.

### Single source of truth ownership matrix

| KPI domain | Canonical dataset/table | SoT steward (business) | SoT steward (technical) | Backup approver |
|---|---|---|---|---|
| Revenue + retention (MRR/ARR/NRR) | `warehouse.revops_kpi_daily` | Finance/RevOps | RevOps Analytics | CFO delegate |
| Reliability (uptime, p95 latency) | `warehouse.reliability_sli_daily` | SRE | Platform Engineering | VP Engineering delegate |
| Support SLA | `warehouse.support_sla_daily` | Support Leadership | Support Operations | COO delegate |
| Gross margin | `warehouse.finops_margin_daily` | Finance | FinOps | Controller delegate |

### Ownership rules

- Dashboards must read only from canonical SoT tables; direct source-system queries are prohibited in production dashboards.
- Each SoT table must have one **Directly Responsible Individual (DRI)** and one backup.
- Data contracts for each SoT table are reviewed monthly and after any schema migration.
- Incident postmortems must include SoT impact assessment when KPI discrepancies exceed tolerance.

## 3) Risk register (probability/impact scoring + mitigation status)

Scoring scale:
- **Probability:** 1 (rare) to 5 (almost certain)
- **Impact:** 1 (negligible) to 5 (critical)
- **Risk score:** `probability * impact`
- **Mitigation status:** `Not started | In progress | Mitigated | Accepted`

| Risk ID | Risk statement | Domain | Probability (1-5) | Impact (1-5) | Score | Mitigation plan | Mitigation owner | Mitigation status | Next review |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | Billing event lag causes understated MRR/ARR for executive reporting windows. | Growth | 3 | 4 | 12 | Add ingestion lag alert at 15-minute threshold; auto-backfill previous 24h on lag breach. | RevOps Analytics | In progress | Weekly |
| R-02 | Inconsistent churn tagging inflates retention/NRR variability by segment. | Growth | 3 | 3 | 9 | Enforce churn reason taxonomy + mandatory cancellation reason validation in workflow. | Customer Success Ops | In progress | Bi-weekly |
| R-03 | SLI collector outage masks uptime and latency regressions. | Reliability | 2 | 5 | 10 | Dual-path telemetry pipeline with heartbeat monitor and synthetic fallback checks. | SRE | In progress | Weekly |
| R-04 | Ticket severity misclassification leads to artificial SLA attainment. | Reliability | 3 | 3 | 9 | Add auto-triage policy with audit sampling and monthly calibration review. | Support Operations | Not started | Monthly |
| R-05 | Cost allocation mapping drift understates direct COGS and overstates gross margin. | Efficiency | 2 | 5 | 10 | Add tag coverage guardrail (`>= 99%`) and block finance close on unmapped spend > 1%. | FinOps | In progress | Weekly |
| R-06 | Manual KPI extract overrides bypass SoT controls and create conflicting board metrics. | Cross-functional | 2 | 4 | 8 | Disable ad hoc production workbook exports; enforce signed publish workflow and audit trail. | Data Platform | Mitigated | Monthly |

## 4) Quarterly objectives (reliability, growth, efficiency)

### Objective set

| Objective ID | Outcome area | Objective | Key results (quarterly) | Executive owner |
|---|---|---|---|---|
| O-R1 | Reliability | Improve platform resilience while preserving tenant experience. | 1) Maintain monthly uptime >= 99.95%. 2) Hold tier-1 API p95 latency <= 350 ms for >= 95% of days. 3) Achieve support SLA attainment >= 95% across paid plans. | VP Engineering |
| O-G1 | Growth | Increase durable recurring revenue quality from existing and new tenants. | 1) Grow MRR by >= 8% QoQ. 2) Maintain NRR >= 110%. 3) Keep gross retention >= 92%. | CRO |
| O-E1 | Efficiency | Improve unit economics while maintaining service quality. | 1) Reach blended gross margin >= 68%. 2) Reduce cost-to-serve per active tenant by >= 12%. 3) Keep SoT KPI discrepancy rate <= 0.5% for monthly close. | CFO |

### Execution cadence

- **Weekly:** KPI review in operations governance meeting (owners report variances and mitigations).
- **Bi-weekly:** Risk register refresh with probability/impact rescoring for top-10 risks.
- **Monthly:** SoT data contract review and reconciliation sign-off.
- **Quarterly:** Objective scoring (0.0-1.0), target reset, and owner re-commit.

### Exit criteria for quarter close

- 100% of KPI pack metrics have approved variance commentary.
- 100% of high-score risks (score >= 10) have active mitigation workstreams.
- Quarterly objective scorecards approved by VP Engineering, CRO, and CFO.
