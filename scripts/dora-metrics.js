#!/usr/bin/env node

const fs = require('fs');

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

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursBetween(a, b) {
  return Math.max((b.getTime() - a.getTime()) / (1000 * 60 * 60), 0);
}

function loadEvents(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('DORA event file must be a JSON array.');
  }

  return parsed;
}

function compute(events, lookbackDays) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const deployments = events
    .filter((event) => event.type === 'deployment')
    .map((event) => ({ ...event, at: toDate(event.at) }))
    .filter((event) => event.at && event.at >= windowStart);

  const incidents = events
    .filter((event) => event.type === 'incident')
    .map((event) => ({ ...event, started_at: toDate(event.started_at), resolved_at: toDate(event.resolved_at) }))
    .filter((event) => event.started_at && event.started_at >= windowStart);

  const totalDeployments = deployments.length;
  const failedDeployments = deployments.filter((event) => event.outcome === 'failed').length;
  const deploymentFrequency = totalDeployments / Math.max(lookbackDays, 1);
  const changeFailureRate = totalDeployments ? (failedDeployments / totalDeployments) * 100 : 0;

  const mttrSamples = incidents
    .filter((event) => event.resolved_at)
    .map((event) => hoursBetween(event.started_at, event.resolved_at));

  const mttrHours = mttrSamples.length
    ? mttrSamples.reduce((sum, value) => sum + value, 0) / mttrSamples.length
    : 0;

  return {
    lookback_days: lookbackDays,
    deployment_frequency_per_day: Number(deploymentFrequency.toFixed(4)),
    change_failure_rate_pct: Number(changeFailureRate.toFixed(2)),
    mttr_hours: Number(mttrHours.toFixed(2)),
    deployments: totalDeployments,
    failed_deployments: failedDeployments,
    incidents: incidents.length,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const path = args.input || process.env.DORA_EVENTS_FILE;

  if (!path) {
    throw new Error('Provide --input=<events.json> or DORA_EVENTS_FILE');
  }

  const lookbackDays = Math.max(Number(args.lookback_days || process.env.DORA_LOOKBACK_DAYS || 30), 1);
  const events = loadEvents(path);
  const summary = compute(events, lookbackDays);

  console.log(JSON.stringify(summary, null, 2));
}

main();
