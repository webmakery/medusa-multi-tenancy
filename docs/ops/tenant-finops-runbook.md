# Tenant FinOps Runbook

This runbook defines how to tag infrastructure/services by workload, attribute usage cost to tenant segments, monitor gross margin by plan, alert on spend anomalies, and operate an ROI-ranked optimization backlog.

## 1) Resource tagging standard (workload-first)

Every infrastructure and platform service must emit or inherit the following tags/labels:

- `service_name`
- `workload`
- `environment`
- `region`
- `owner_team`
- `tenant_cost_attribution` (`direct`, `shared-allocatable`, `shared-unallocatable`)

### Workload taxonomy

Use only these workload values:

- `api-online`
- `worker-async`
- `analytics-batch`
- `data-pipeline`
- `storage-hot`
- `storage-cold`

### Validation guardrails

- Enforce required tags through IaC policy checks in CI.
- Reject deploys that remove required tags from existing services.
- Track weekly tag coverage; target: **>= 98%** of cloud spend with required tags.

## 2) Tenant-segment cost attribution

Goal: map usage cost down to tenant segment (`smb`, `mid_market`, `enterprise`) wherever technically possible.

### Attribution classes

1. **Direct**
   - Cost line already includes `tenant_id` and can be assigned exactly.
2. **Shared-allocatable**
   - Shared service cost split by measurable usage driver.
3. **Shared-unallocatable**
   - No reliable usage driver; allocate with weighted fallback and track separately.

### Allocation drivers (preferred order)

1. `compute_seconds`
2. `request_count`
3. `storage_gb_days`
4. `event_volume`

### Fallback weighting for unallocatable shared spend

| Segment | Weight |
| --- | --- |
| smb | 1 |
| mid_market | 2 |
| enterprise | 4 |

### Quality targets

- **Tenant-mappable coverage**: >= 90% of total spend should be `direct` or `shared-allocatable`.
- Keep unallocatable shared spend as a visibly reported residual.

## 3) Gross margin tracking by plan and cost drivers

Track gross margin at least weekly (snapshot) and monthly (finance close).

### Gross margin model

- `gross_margin = recognized_revenue - COGS`
- COGS drivers tracked explicitly:
  - `db_cost`
  - `compute_cost`
  - `storage_cost`
  - `external_api_cost`

### Required dashboard/report views

- Gross margin by billing plan
- Gross margin by billing plan + tenant segment
- Cost driver share by plan (DB/compute/storage/external APIs)
- Top 10 month-over-month cost driver increases

### Review thresholds

- Trigger investigation if plan gross margin drops by >= 5 percentage points week-over-week.
- Trigger investigation if any single cost driver grows > 20% week-over-week without corresponding usage growth.

## 4) Cost anomaly alerts and automated weekly reporting

### Required anomaly alerts

1. **Service/workload day-over-day spike** (High)
   - Condition: daily spend >= 1.5x trailing 14-day average and delta >= $500
   - Route: `finops-oncall`, owning engineering team
   - Response SLA: 2 hours

2. **Tenant segment spike** (Medium)
   - Condition: daily segment cost >= 1.4x trailing 28-day same-weekday average
   - Route: `finops-triage`
   - Response SLA: 8 hours

3. **Unit economics regression** (High)
   - Condition: gross margin % drops >= 5 points week-over-week by plan
   - Route: `finops-oncall`, finance partner, product owner
   - Response SLA: 1 business day

### Weekly automated spend report

- Report name: `finops-weekly-spend-and-margin`
- Schedule: every Monday 09:00 UTC
- Recipients:
  - FinOps
  - Engineering leads
  - Finance business partner
  - Product leadership

#### Mandatory sections

- Total spend and spend by workload
- Spend by tenant segment
- Gross margin by plan
- Top cost-driver changes (DB, compute, storage, external APIs)
- Opened/resolved anomalies
- Optimization backlog progress

## 5) Optimization backlog with ROI ranking

Maintain a single backlog for cost optimization initiatives with explicit ranking logic.

### Prioritization formula

`ROI_score = annualized_savings_usd * confidence / implementation_weeks`

Confidence multipliers:

- High = `1.0`
- Medium = `0.7`
- Low = `0.4`

### Ranking policy

1. Prioritize **high savings + low risk** initiatives first.
2. Do not schedule high-risk items ahead of low-risk items unless expected annual savings is at least 3x.
3. Re-rank backlog weekly after anomaly review.

### Required backlog fields

- initiative_name
- owner
- primary_cost_driver
- estimated_annual_savings_usd
- estimated_effort_weeks
- confidence
- risk
- blockers
- target_quarter
- status

## 6) Operating cadence

### Weekly FinOps Review (30 minutes)

Attendees: FinOps, owning engineering leads, finance partner, product owner.

Agenda:

1. Validate tag coverage and tenant-attribution coverage against targets.
2. Review anomaly alerts fired, status, and mitigations.
3. Review gross margin movement by plan and top cost-driver deltas.
4. Re-rank optimization backlog by ROI and risk.
5. Confirm owners and due dates for top initiatives.

### Monthly margin deep dive (60 minutes)

- Validate monthly close numbers versus weekly snapshots.
- Re-baseline allocation assumptions and fallback weights.
- Confirm whether plan pricing/packaging adjustments are needed based on sustained margin pressure.

## 7) Implementation checklist

- [ ] Add required workload and attribution tags to all cloud resources/services.
- [ ] Enforce tag compliance in CI/IaC policy checks.
- [ ] Implement tenant-segment allocation pipeline for direct and shared-allocatable spend.
- [ ] Publish gross margin dashboards by plan and segment with DB/compute/storage/external API breakouts.
- [ ] Configure the 3 required anomaly alerts with routing and SLAs.
- [ ] Schedule and distribute the weekly automated spend report.
- [ ] Create optimization backlog with required fields and ROI scoring.
- [ ] Establish weekly FinOps Review and monthly margin deep-dive rituals.
