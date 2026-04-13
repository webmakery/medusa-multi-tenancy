#!/usr/bin/env node

const fs = require('fs');
const { Client } = require('pg');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

async function gatherCurrent(client, tableName) {
  const totalResult = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${tableName}`);
  const total = Number(totalResult.rows[0].count);

  const hasTenantIdResult = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = 'tenant_id'
      ) AS has_tenant_id
    `,
    [tableName]
  );

  const hasTenantId = Boolean(hasTenantIdResult.rows[0].has_tenant_id);

  if (!hasTenantId) {
    return {
      table: tableName,
      total,
      hasTenantId,
      nullTenantIdCount: null,
      orphanTenantIdCount: null,
    };
  }

  const nullTenantResult = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM ${tableName} WHERE tenant_id IS NULL`
  );
  const orphanResult = await client.query(
    `
      SELECT COUNT(*)::bigint AS count
      FROM ${tableName} t
      LEFT JOIN tenant ten ON ten.id = t.tenant_id
      WHERE t.tenant_id IS NOT NULL
        AND ten.id IS NULL
    `
  );

  return {
    table: tableName,
    total,
    hasTenantId,
    nullTenantIdCount: Number(nullTenantResult.rows[0].count),
    orphanTenantIdCount: Number(orphanResult.rows[0].count),
  };
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function run() {
  const args = parseArgs(process.argv);
  const baselinePath = args.baseline;

  if (!baselinePath) {
    throw new Error('Missing required argument --baseline');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }

  const rawBaseline = fs.readFileSync(baselinePath, 'utf8');
  const baseline = JSON.parse(rawBaseline);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const mismatches = [];

  try {
    for (const tableEntry of baseline.tables || []) {
      const current = await gatherCurrent(client, tableEntry.table);

      if (current.total !== tableEntry.total) {
        mismatches.push(
          `${tableEntry.table}: row count changed from ${tableEntry.total} to ${current.total}`
        );
      }

      if (tableEntry.hasTenantId && !current.hasTenantId) {
        mismatches.push(`${tableEntry.table}: tenant_id column disappeared`);
        continue;
      }

      if (current.hasTenantId && current.nullTenantIdCount > 0) {
        mismatches.push(
          `${tableEntry.table}: ${current.nullTenantIdCount} rows still have tenant_id IS NULL`
        );
      }

      if (current.hasTenantId && current.orphanTenantIdCount > 0) {
        mismatches.push(
          `${tableEntry.table}: ${current.orphanTenantIdCount} rows reference a missing tenant`
        );
      }

      console.log(
        `Validated ${tableEntry.table}: total=${current.total}, ` +
          `null_tenant_id=${current.nullTenantIdCount ?? 'n/a'}, orphan_tenant_id=${
            current.orphanTenantIdCount ?? 'n/a'
          }`
      );
    }
  } finally {
    await client.end();
  }

  if (mismatches.length) {
    fail(`Backfill validation failed:\n- ${mismatches.join('\n- ')}`);
  }

  console.log('✅ Backfill validation passed.');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
