#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'src', 'modules');
const TENANT_TABLES = [
  'app_installation',
  'app_scope',
  'app_webhook',
  'app_credential',
  'app_webhook_delivery_log',
  'theme_metadata',
  'theme_config',
  'theme_publish_status',
  'analytics_event',
  'analytics_rollup_daily',
  'analytics_top_product_daily',
  'audit_log',
  'tenant_membership',
  'tenant_invitation',
  'tenant',
];

const violations = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.name.endsWith('service.ts')) {
      continue;
    }

    inspectFile(fullPath);
  }
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const tableMatch = line.match(/\b(?:knex|trx)\('([^']+)'\)/);

    if (!tableMatch) {
      continue;
    }

    const tableName = tableMatch[1];

    if (!TENANT_TABLES.includes(tableName)) {
      continue;
    }

    let windowText = '';
    for (let offset = -2; offset <= 8; offset += 1) {
      const lineIndex = i + offset;
      if (lineIndex < 0 || lineIndex >= lines.length) {
        continue;
      }
      windowText += `${lines[lineIndex]}\n`;
    }

    const hasTenantScope =
      /tenant_id\s*:/.test(windowText) ||
      /where\(\s*['"]tenant_id['"]/.test(windowText) ||
      /andWhere\(\s*['"]tenant_id['"]/.test(windowText) ||
      /whereIn\([^\n]+tenant_id/.test(windowText);

    const skipReason = /tenant-scope-ignore/.test(windowText);

    if (!hasTenantScope && !skipReason) {
      violations.push({
        filePath: path.relative(ROOT, filePath),
        line: i + 1,
        tableName,
      });
    }
  }
}

walk(TARGET_DIR);

if (violations.length) {
  console.error('Found unscoped tenant queries:');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line} (${violation.tableName})`);
  }
  process.exit(1);
}

console.log('Tenant query scope check passed.');
