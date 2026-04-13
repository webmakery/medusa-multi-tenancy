# Monthly churn review playbook

## Cadence
- Run on the first business day of each month.
- Review churn for the full prior month.

## Required inputs
- Canceled tenants by segment and plan.
- Exit survey tags and support cancellation notes.
- Setup diagnostics from onboarding dashboard.
- Billing status transitions (`past_due`, `grace_period`, `suspended`).

## Top churn reasons to review

| Churn reason | Product action | Ops action | Owner |
| --- | --- | --- | --- |
| Time-to-value too long | Prioritize guided onboarding checklist improvements and first-value nudges. | Trigger week-1 setup success outreach for blocked tenants. | Product + CX |
| Team setup stalled | Improve invite flow clarity and permission defaults. | Create retry campaign for pending invites older than 3 days. | Product + Lifecycle Ops |
| Domain or webhook setup blockers | Improve diagnostics and actionable error hints in admin. | Weekly proactive review of blocked diagnostics accounts. | Platform + Support |
| Permission misconfiguration | Add setup guardrails for missing owner/admin coverage. | Escalate high-risk accounts to implementation support. | Security + Support |
| Billing friction | Improve failed payment in-app guidance and grace-period messaging. | Launch dunning sequence with assisted recovery option. | Billing + RevOps |

## Monthly output artifact
Create a short report with:
1. Top 3 churn reasons and impact share.
2. Product actions with target release month.
3. Ops actions with campaign owner and due date.
4. Follow-up metrics to validate change impact next month.
