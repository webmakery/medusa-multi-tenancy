#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { config: 'docs/ops/compliance-program-plan.json' };

  for (const arg of argv) {
    if (arg.startsWith('--config=')) {
      args.config = arg.slice('--config='.length);
    }
  }

  return args;
}

function parseDate(value, fieldName) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date string`);
  }

  return parsed;
}

function asISODate(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function validateFrameworkMapping(control, failures) {
  const mapping = control.framework_mappings || {};
  const hasSoc2 = Array.isArray(mapping.soc2) && mapping.soc2.length > 0;
  const hasIso27001 = Array.isArray(mapping.iso27001) && mapping.iso27001.length > 0;

  if (!hasSoc2) {
    failures.push(`${control.id}: missing SOC 2 mapping`);
  }

  if (!hasIso27001) {
    failures.push(`${control.id}: missing ISO 27001 mapping`);
  }

  if (mapping.applies_to_privacy) {
    const hasGdpr = Array.isArray(mapping.gdpr) && mapping.gdpr.length > 0;
    const hasCcpa = Array.isArray(mapping.ccpa) && mapping.ccpa.length > 0;

    if (!hasGdpr) {
      failures.push(`${control.id}: privacy-applicable control is missing GDPR mapping`);
    }

    if (!hasCcpa) {
      failures.push(`${control.id}: privacy-applicable control is missing CCPA mapping`);
    }
  }
}

function evaluateEvidenceCadence(control, today, failures, warnings) {
  if (!control.recurring) {
    return null;
  }

  if (!Number.isFinite(control.cadence_days) || control.cadence_days <= 0) {
    failures.push(`${control.id}: recurring control must define cadence_days > 0`);
    return null;
  }

  if (!control.last_evidence_at) {
    failures.push(`${control.id}: recurring control must define last_evidence_at`);
    return null;
  }

  const lastEvidenceAt = parseDate(control.last_evidence_at, `${control.id}.last_evidence_at`);
  const nextDueAt = new Date(lastEvidenceAt.getTime());
  nextDueAt.setUTCDate(nextDueAt.getUTCDate() + control.cadence_days);

  const daysUntilDue = daysBetween(today, nextDueAt);
  let status = 'on_track';

  if (daysUntilDue < 0) {
    status = 'overdue';
    failures.push(`${control.id}: evidence collection is overdue (next due ${asISODate(nextDueAt)})`);
  } else if (daysUntilDue <= 7) {
    status = 'due_soon';
    warnings.push(`${control.id}: evidence due within ${daysUntilDue} day(s) (${asISODate(nextDueAt)})`);
  }

  return {
    id: control.id,
    name: control.name,
    next_due_at: asISODate(nextDueAt),
    status,
  };
}

function validateDpaAndSubprocessors(section, failures) {
  if (!section || typeof section !== 'object') {
    failures.push('dpa_and_subprocessors section is required');
    return;
  }

  if (!section.dpa_url) {
    failures.push('dpa_and_subprocessors.dpa_url is required');
  }

  if (!section.subprocessor_url) {
    failures.push('dpa_and_subprocessors.subprocessor_url is required');
  }

  if (!Array.isArray(section.customer_data_handling_commitments) || section.customer_data_handling_commitments.length === 0) {
    failures.push('dpa_and_subprocessors.customer_data_handling_commitments must include at least one commitment');
  }

  if (!section.last_reviewed_at) {
    failures.push('dpa_and_subprocessors.last_reviewed_at is required');
  }
}

function validateMilestones(milestones, today, failures, warnings) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    failures.push('at least one milestone is required');
    return [];
  }

  const allowedTypes = new Set(['internal_control_testing', 'external_audit_readiness']);

  const normalized = milestones.map((milestone) => {
    if (!allowedTypes.has(milestone.type)) {
      failures.push(`milestone "${milestone.name}" has unsupported type "${milestone.type}"`);
    }

    const date = parseDate(milestone.scheduled_for, `milestone(${milestone.name}).scheduled_for`);
    const daysUntil = daysBetween(today, date);

    if (daysUntil < 0) {
      warnings.push(`milestone "${milestone.name}" is in the past (${milestone.scheduled_for})`);
    }

    return {
      ...milestone,
      scheduled_for: asISODate(date),
      days_until: daysUntil,
    };
  });

  const hasInternal = normalized.some((milestone) => milestone.type === 'internal_control_testing');
  const hasExternal = normalized.some((milestone) => milestone.type === 'external_audit_readiness');

  if (!hasInternal) {
    failures.push('missing internal_control_testing milestone');
  }

  if (!hasExternal) {
    failures.push('missing external_audit_readiness milestone');
  }

  return normalized.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(process.cwd(), args.config);
  const raw = fs.readFileSync(configPath, 'utf8');
  const plan = JSON.parse(raw);

  const failures = [];
  const warnings = [];
  const today = new Date();

  if (!Array.isArray(plan.control_catalog) || plan.control_catalog.length === 0) {
    failures.push('control_catalog must include at least one control');
  }

  const evidenceSchedule = [];

  for (const control of plan.control_catalog || []) {
    if (!control.id || !control.name) {
      failures.push('all controls must include id and name');
      continue;
    }

    validateFrameworkMapping(control, failures);

    const evidence = evaluateEvidenceCadence(control, today, failures, warnings);
    if (evidence) {
      evidenceSchedule.push(evidence);
    }
  }

  validateDpaAndSubprocessors(plan.dpa_and_subprocessors, failures);
  const milestones = validateMilestones(plan.milestones, today, failures, warnings);

  console.log('Compliance readiness summary');
  console.log(`- Controls reviewed: ${(plan.control_catalog || []).length}`);
  console.log(`- Recurring evidence schedules: ${evidenceSchedule.length}`);

  if (evidenceSchedule.length) {
    console.log('\nEvidence collection schedule');
    for (const entry of evidenceSchedule) {
      console.log(`- ${entry.id} (${entry.name}): ${entry.status}, next due ${entry.next_due_at}`);
    }
  }

  if (milestones.length) {
    console.log('\nControl testing and external audit milestones');
    for (const milestone of milestones) {
      console.log(`- ${milestone.scheduled_for} (${milestone.days_until} day(s)): [${milestone.type}] ${milestone.name} — owner: ${milestone.owner}`);
    }
  }

  if (warnings.length) {
    console.warn('\nCompliance readiness warnings:');
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (failures.length) {
    console.error('\nCompliance readiness failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nCompliance readiness passed. Controls are mapped, recurring evidence automation is schedulable, DPA/subprocessor commitments are present, and milestones are defined.');
}

main();
