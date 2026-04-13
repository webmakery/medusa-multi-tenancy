#!/usr/bin/env node

/**
 * Capacity staged load model for tenant traffic planning.
 *
 * This script runs a deterministic staged model (warm-up, steady, ramp, recovery)
 * and emits a report with inferred bottlenecks and published capacity numbers.
 */

const DEFAULTS = {
  expectedActiveTenants: 420,
  peakConcurrentUsers: 2400,
  peakRps: 1200,
  requestMix: {
    auth: 5,
    read: 45,
    write: 20,
    reporting: 10,
    webhooks: 10,
    backgroundJobs: 10,
  },
};

const SATURATION = {
  dbPoolPct: 85,
  dbWaitP95Ms: 50,
  queueLagP95Sec: 120,
  cpuPct: 75,
  apiP95Ms: 450,
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (key === 'expected-active-tenants' && next) {
      out.expectedActiveTenants = Number(next);
      i++;
    } else if (key === 'peak-concurrent-users' && next) {
      out.peakConcurrentUsers = Number(next);
      i++;
    } else if (key === 'peak-rps' && next) {
      out.peakRps = Number(next);
      i++;
    }
  }

  return out;
}

function buildStages(peakRps) {
  return [
    { name: 'warm-up', percent: 0.5, minutes: 15 },
    { name: 'steady-state', percent: 1.0, minutes: 45 },
    { name: 'ramp-110', percent: 1.1, minutes: 10 },
    { name: 'ramp-120', percent: 1.2, minutes: 10 },
    { name: 'ramp-130', percent: 1.3, minutes: 10 },
    { name: 'ramp-140', percent: 1.4, minutes: 10 },
    { name: 'recovery', percent: 0.7, minutes: 20 },
  ].map((stage) => ({ ...stage, targetRps: Math.round(stage.percent * peakRps) }));
}

function calcMetrics(targetRps, peakRps) {
  const load = targetRps / peakRps;

  const cpuPct = Math.min(95, 28 + load * 38 + Math.max(0, load - 1) * 30);
  const dbPoolPct = Math.min(98, 34 + load * 42 + Math.max(0, load - 1) * 60);
  const dbWaitP95Ms = Math.max(5, Math.round(8 + Math.max(0, load - 0.9) * 145));
  const queueLagP95Sec = Math.max(18, Math.round(20 + Math.max(0, load - 0.95) * 360));
  const apiP95Ms = Math.max(120, Math.round(180 + Math.max(0, load - 0.75) * 420));
  const errorRatePct = Number((0.15 + Math.max(0, load - 1.1) * 1.6).toFixed(2));

  return {
    cpuPct: Number(cpuPct.toFixed(1)),
    dbPoolPct: Number(dbPoolPct.toFixed(1)),
    dbWaitP95Ms,
    queueLagP95Sec,
    apiP95Ms,
    errorRatePct,
  };
}

function bottlenecks(metrics) {
  const found = [];

  if (metrics.dbPoolPct >= SATURATION.dbPoolPct || metrics.dbWaitP95Ms >= SATURATION.dbWaitP95Ms) {
    found.push('database connection pressure');
  }

  if (metrics.queueLagP95Sec >= SATURATION.queueLagP95Sec) {
    found.push('queue lag pressure');
  }

  if (metrics.cpuPct >= SATURATION.cpuPct) {
    found.push('compute pressure');
  }

  if (metrics.apiP95Ms >= SATURATION.apiP95Ms) {
    found.push('api latency pressure');
  }

  return found;
}

function main() {
  const cfg = parseArgs(process.argv);
  const stages = buildStages(cfg.peakRps);

  const stageResults = stages.map((stage) => {
    const metrics = calcMetrics(stage.targetRps, cfg.peakRps);
    const stageBottlenecks = bottlenecks(metrics);

    return {
      ...stage,
      metrics,
      bottlenecks: stageBottlenecks,
      saturated: stageBottlenecks.length > 0,
    };
  });

  const firstSaturation = stageResults.find((entry) => entry.saturated);
  const maxSustainableRps = firstSaturation
    ? stageResults[stageResults.indexOf(firstSaturation) - 1]?.targetRps ?? Math.round(cfg.peakRps * 0.9)
    : Math.round(cfg.peakRps * 1.4);

  const publishedRps = Math.floor(maxSustainableRps * 0.75);

  const report = {
    generated_at: new Date().toISOString(),
    expected_active_tenants: cfg.expectedActiveTenants,
    peak_concurrent_users: cfg.peakConcurrentUsers,
    request_mix_percent: cfg.requestMix,
    stages: stageResults,
    first_saturation_stage: firstSaturation?.name ?? null,
    first_saturation_bottlenecks: firstSaturation?.bottlenecks ?? [],
    max_sustainable_rps: maxSustainableRps,
    published_capacity_rps: publishedRps,
    safety_margin_pct: 25,
    scaling_triggers: {
      api_scale_out: 'cpu>=60% + api_p95>=320ms for 5m OR in_flight>=75%',
      worker_scale_out: 'queue_lag_p95>=60s for 5m OR queue_depth>=1.5x baseline',
      db_action: 'db_pool>=75% for 5m or db_wait_p95>=35ms',
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
