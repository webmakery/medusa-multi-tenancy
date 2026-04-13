# Compliance readiness runbook

This runbook operationalizes control mapping, recurring evidence automation, DPA/subprocessor validation, and milestone scheduling for security/privacy audits.

## Source of truth

- Plan file: `docs/ops/compliance-program-plan.json`
- Validator: `scripts/compliance-readiness.js`
- Command: `yarn compliance:readiness`

## 1) Control mapping to target frameworks

Each control in `control_catalog` must include mappings for:

- SOC 2 (`framework_mappings.soc2`)
- ISO 27001 (`framework_mappings.iso27001`)
- GDPR/CCPA for privacy-applicable controls (`framework_mappings.applies_to_privacy=true`)

Validation gates:

- Missing SOC 2 mapping fails validation.
- Missing ISO 27001 mapping fails validation.
- If privacy-applicable, missing GDPR/CCPA mapping fails validation.

## 2) Recurring evidence collection automation

Recurring controls use the following fields:

- `recurring=true`
- `cadence_days`
- `last_evidence_at`
- `evidence.collection_method` (expected `automation` where supported)
- `evidence.artifact_path`

The validator computes `next_due_at` and classifies status:

- `on_track`: due in more than 7 days
- `due_soon`: due in 7 days or less (warning)
- `overdue`: due date in the past (validation failure)

## 3) DPA/subprocessor and customer data handling validation

The `dpa_and_subprocessors` section must include:

- `dpa_url`
- `subprocessor_url`
- `last_reviewed_at`
- `customer_data_handling_commitments` (non-empty)

Validation fails if any required disclosure or commitment is missing.

## 4) Internal testing and external audit readiness milestones

Milestones are stored in `milestones` with required types:

- `internal_control_testing`
- `external_audit_readiness`

Validation enforces that at least one of each type exists and prints the schedule ordered by date.

## 5) Operating procedure

Run before each compliance review and at least weekly:

```bash
yarn compliance:readiness
```

Expected outcome:

- Exit `0`: mappings, commitments, and milestones are complete; no overdue recurring evidence.
- Non-zero exit: missing framework mappings, disclosure gaps, or overdue controls.

