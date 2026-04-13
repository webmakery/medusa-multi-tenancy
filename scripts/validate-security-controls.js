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
warnIfMissing('BACKUP_RESTORE_DRILL_LAST_AT', 'set after latest successful restore drill');
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

console.log('Security validation passed. Encryption, secret management, and backup controls meet baseline policy checks.');
