#!/usr/bin/env node

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

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }

  const args = parseArgs(process.argv);
  const lookbackHours = Math.max(Number(args.lookback_hours || 48), 1);
  const duplicateThresholdPct = Number(args.duplicate_threshold_pct || 0.1);
  const lossThresholdPct = Number(args.loss_threshold_pct || 0.2);
  const lateThresholdPct = Number(args.late_threshold_pct || 1);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const duplicateResult = await client.query(
      `
        WITH source AS (
          SELECT id, COUNT(*)::int AS duplicate_count
          FROM analytics_event
          WHERE created_at >= NOW() - ($1::text || ' hours')::interval
          GROUP BY id
        )
        SELECT
          COALESCE(SUM(CASE WHEN duplicate_count > 1 THEN duplicate_count - 1 ELSE 0 END), 0)::bigint AS duplicate_rows,
          COALESCE(SUM(duplicate_count), 0)::bigint AS total_rows
        FROM source
      `,
      [lookbackHours]
    );

    const rollupLossResult = await client.query(
      `
        WITH raw AS (
          SELECT tenant_id, event_date::date AS event_date, COUNT(*)::bigint AS raw_checkout_completed
          FROM analytics_event
          WHERE event_type = 'checkout_completed'
            AND event_date >= (CURRENT_DATE - INTERVAL '7 days')
          GROUP BY tenant_id, event_date::date
        ),
        rolled AS (
          SELECT tenant_id, rollup_date::date AS rollup_date, SUM(checkout_completed_count)::bigint AS rollup_checkout_completed
          FROM analytics_rollup_daily
          WHERE rollup_date >= (CURRENT_DATE - INTERVAL '7 days')
          GROUP BY tenant_id, rollup_date::date
        )
        SELECT
          COALESCE(SUM(ABS(COALESCE(raw.raw_checkout_completed, 0) - COALESCE(rolled.rollup_checkout_completed, 0))), 0)::bigint AS absolute_delta,
          COALESCE(SUM(COALESCE(raw.raw_checkout_completed, 0)), 0)::bigint AS raw_total
        FROM raw
        FULL OUTER JOIN rolled
          ON raw.tenant_id = rolled.tenant_id
         AND raw.event_date = rolled.rollup_date
      `
    );

    const lateArrivalResult = await client.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE created_at - event_timestamp > INTERVAL '24 hours'
          )::bigint AS late_rows,
          COUNT(*)::bigint AS total_rows
        FROM analytics_event
        WHERE created_at >= NOW() - ($1::text || ' hours')::interval
      `,
      [lookbackHours]
    );

    const duplicateRows = Number(duplicateResult.rows[0].duplicate_rows || 0);
    const duplicateTotalRows = Number(duplicateResult.rows[0].total_rows || 0);
    const duplicatePct = pct(duplicateRows, duplicateTotalRows);

    const rollupAbsoluteDelta = Number(rollupLossResult.rows[0].absolute_delta || 0);
    const rollupRawTotal = Number(rollupLossResult.rows[0].raw_total || 0);
    const lossPct = pct(rollupAbsoluteDelta, rollupRawTotal);

    const lateRows = Number(lateArrivalResult.rows[0].late_rows || 0);
    const lateTotalRows = Number(lateArrivalResult.rows[0].total_rows || 0);
    const latePct = pct(lateRows, lateTotalRows);

    console.log(`duplicate_event_rate=${duplicatePct.toFixed(4)}% (${duplicateRows}/${duplicateTotalRows})`);
    console.log(`rollup_loss_rate=${lossPct.toFixed(4)}% (${rollupAbsoluteDelta}/${rollupRawTotal})`);
    console.log(`late_arrival_share=${latePct.toFixed(4)}% (${lateRows}/${lateTotalRows})`);

    const failures = [];

    if (duplicatePct > duplicateThresholdPct) {
      failures.push(
        `Duplicate rate ${duplicatePct.toFixed(4)}% breached threshold ${duplicateThresholdPct.toFixed(4)}%`
      );
    }

    if (lossPct > lossThresholdPct) {
      failures.push(`Rollup loss ${lossPct.toFixed(4)}% breached threshold ${lossThresholdPct.toFixed(4)}%`);
    }

    if (latePct > lateThresholdPct) {
      failures.push(`Late-arrival ${latePct.toFixed(4)}% breached threshold ${lateThresholdPct.toFixed(4)}%`);
    }

    if (failures.length) {
      throw new Error(`Analytics pipeline validation failed:\n- ${failures.join('\n- ')}`);
    }

    console.log('✅ Analytics pipeline validation passed.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
