#!/usr/bin/env node

const { spawnSync } = require('child_process');

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

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function run(command) {
  if (!command) return;

  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function sloBreached(input) {
  return (
    input.errorRate > input.maxErrorRate ||
    input.p95LatencyMs > input.maxP95LatencyMs ||
    input.availability < input.minAvailability
  );
}

function printTenantRollout(flagConfig) {
  const flags = Object.entries(flagConfig || {});

  if (!flags.length) {
    console.log('No tenant-scoped overrides provided for this rollout.');
    return;
  }

  console.log('Tenant-scoped feature flag rollout plan:');
  for (const [flag, definition] of flags) {
    const tenants = Object.entries((definition && definition.tenants) || {});

    if (!tenants.length) {
      continue;
    }

    console.log(`  ${flag}:`);
    for (const [tenantId, config] of tenants) {
      console.log(
        `    - ${tenantId}: enabled=${Boolean(config.enabled)}, strategy=${config.strategy || definition.strategy || 'all'}, canary_percentage=${config.canary_percentage ?? definition.canary_percentage ?? 0}, blue_environment=${config.blue_environment ?? definition.blue_environment ?? 'blue'}`
      );
    }
  }
}

function main() {
  const args = parseArgs(process.argv);

  const strategy = args.strategy || process.env.RELEASE_STRATEGY || 'canary';
  if (!['canary', 'blue-green'].includes(strategy)) {
    throw new Error(`Unsupported release strategy: ${strategy}`);
  }

  const flagConfig = process.env.TENANT_FEATURE_FLAGS ? JSON.parse(process.env.TENANT_FEATURE_FLAGS) : {};

  const metrics = {
    errorRate: toNumber(args.error_rate ?? process.env.CURRENT_ERROR_RATE, 0),
    maxErrorRate: toNumber(args.max_error_rate ?? process.env.SLO_MAX_ERROR_RATE, 0.02),
    p95LatencyMs: toNumber(args.p95_latency_ms ?? process.env.CURRENT_P95_LATENCY_MS, 0),
    maxP95LatencyMs: toNumber(args.max_p95_latency_ms ?? process.env.SLO_MAX_P95_LATENCY_MS, 500),
    availability: toNumber(args.availability ?? process.env.CURRENT_AVAILABILITY, 1),
    minAvailability: toNumber(args.min_availability ?? process.env.SLO_MIN_AVAILABILITY, 0.995),
  };

  const deployCommand = args.deploy_command || process.env.RELEASE_DEPLOY_COMMAND;
  const rollbackCommand = args.rollback_command || process.env.RELEASE_ROLLBACK_COMMAND;

  console.log(`Starting ${strategy} rollout...`);
  printTenantRollout(flagConfig);
  run(deployCommand);

  if (sloBreached(metrics)) {
    console.error(
      `SLO breach detected (error_rate=${metrics.errorRate}, p95_latency_ms=${metrics.p95LatencyMs}, availability=${metrics.availability}). Triggering automated rollback.`
    );
    run(rollbackCommand);
    process.exit(1);
  }

  console.log('✅ Release healthy. No rollback required.');
}

main();
