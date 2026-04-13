#!/usr/bin/env node

const failures = [];
const warnings = [];

function requireEnv(name, check, message) {
  const value = process.env[name];

  if (!value) {
    failures.push(`${name}: missing (${message})`);
    return;
  }

  if (check && !check(value)) {
    failures.push(`${name}: invalid value (${message})`);
  }
}

function warnIfMissing(name, message) {
  if (!process.env[name]) {
    warnings.push(`${name}: missing (${message})`);
  }
}

function isNotDefaultSecret(value) {
  return value.length >= 32 && value !== 'supersecret';
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'enabled'].includes(value.toLowerCase());
}

function isPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

const allowedSecretProviders = new Set(['aws-secrets-manager', 'gcp-secret-manager', 'hashicorp-vault']);

requireEnv(
  'JWT_SECRET',
  isNotDefaultSecret,
  'must be set via secret manager and cannot use default development secret'
);
requireEnv(
  'COOKIE_SECRET',
  isNotDefaultSecret,
  'must be set via secret manager and cannot use default development secret'
);
requireEnv(
  'SECRET_PROVIDER',
  (value) => allowedSecretProviders.has(value),
  `must be one of: ${Array.from(allowedSecretProviders).join(', ')}`
);
requireEnv('KMS_KEY_ID', (value) => value.length > 10, 'required for encryption-at-rest controls');
requireEnv('BACKUP_ENCRYPTION_KEY_ID', (value) => value.length > 10, 'required for encrypted backups');
requireEnv('BACKUP_PITR_ENABLED', isTruthy, 'must be enabled for point-in-time restore');
requireEnv('BACKUP_RETENTION_DAYS', (value) => Number(value) >= 35, 'must be at least 35 days');
requireEnv('BACKUP_FREQUENCY_HOURS', (value) => isPositiveNumber(value) && Number(value) <= 24, 'must be <= 24 hours for full snapshot cadence');
requireEnv('TENANT_DATA_RPO_MINUTES', (value) => isPositiveNumber(value) && Number(value) <= 15, 'must be <= 15 minutes');
requireEnv('TENANT_DATA_RTO_SINGLE_TENANT_MINUTES', (value) => isPositiveNumber(value) && Number(value) <= 60, 'must be <= 60 minutes');
requireEnv('TENANT_DATA_RTO_FULL_RESTORE_MINUTES', (value) => isPositiveNumber(value) && Number(value) <= 240, 'must be <= 240 minutes');
warnIfMissing('BACKUP_RESTORE_DRILL_LAST_AT', 'set after latest successful restore drill');
warnIfMissing('RESTORE_DRILL_SINGLE_TENANT_LAST_AT', 'set after latest successful single-tenant restore drill');
warnIfMissing('RESTORE_DRILL_FULL_LAST_AT', 'set after latest successful full restore drill');
warnIfMissing('FAILOVER_RUNBOOK_VERSION', 'set to approved failover runbook version at launch');
warnIfMissing('INCIDENT_RESPONSE_OWNER', 'set to accountable incident response owner/team');
warnIfMissing('RESTORE_TENANT_BOUNDARY_CHECK_LAST_AT', 'set after latest post-restore tenant-boundary validation');
warnIfMissing('SECRETS_LAST_ROTATED_AT', 'set for secret rotation evidence');

if (warnings.length) {
  console.warn('Security validation warnings:');
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

if (failures.length) {
  console.error('Security validation failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('Security validation passed. Encryption, secret management, backup cadence, and recovery objective controls meet baseline policy checks.');
