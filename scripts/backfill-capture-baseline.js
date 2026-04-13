#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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

function getTablesArg(raw) {
  if (!raw) {
    throw new Error('Missing required argument --tables (comma separated list)');
  }

  const tables = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (!tables.length) {
    throw new Error('No table names were parsed from --tables');
  }

  return tables;
}

async function gatherTableBaseline(client, tableName) {
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
      tenantDistribution: null,
    };
  }

  const nullTenantResult = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM ${tableName} WHERE tenant_id IS NULL`
  );
  const nullTenantIdCount = Number(nullTenantResult.rows[0].count);

  const orphanResult = await client.query(
    `
      SELECT COUNT(*)::bigint AS count
      FROM ${tableName} t
      LEFT JOIN tenant ten ON ten.id = t.tenant_id
      WHERE t.tenant_id IS NOT NULL
        AND ten.id IS NULL
    `
  );

  const tenantDistributionResult = await client.query(
    `
      SELECT tenant_id, COUNT(*)::bigint AS count
      FROM ${tableName}
      WHERE tenant_id IS NOT NULL
      GROUP BY tenant_id
      ORDER BY tenant_id
    `
  );

  return {
    table: tableName,
    total,
    hasTenantId,
    nullTenantIdCount,
    orphanTenantIdCount: Number(orphanResult.rows[0].count),
    tenantDistribution: tenantDistributionResult.rows.map((row) => ({
      tenant_id: row.tenant_id,
      count: Number(row.count),
    })),
  };
}

async function run() {
  const args = parseArgs(process.argv);
  const tables = getTablesArg(args.tables);
  const output = args.output || `./artifacts/backfill-baseline-${Date.now()}.json`;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const checks = [];
    for (const table of tables) {
      checks.push(await gatherTableBaseline(client, table));
    }

    const payload = {
      captured_at: new Date().toISOString(),
      schema: 'public',
      tables: checks,
    };

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(payload, null, 2));

    console.log(`Baseline captured to ${output}`);
    for (const entry of checks) {
      console.log(
        `${entry.table}: total=${entry.total}` +
          (entry.hasTenantId
            ? `, null_tenant_id=${entry.nullTenantIdCount}, orphan_tenant_id=${entry.orphanTenantIdCount}`
            : ', tenant_id column missing')
      );
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
