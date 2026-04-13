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

function runCommand(command) {
  console.log(`\n▶ quality-gate step: ${command}`);

  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Step failed: ${command}`);
  }
}

function parseCommandList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv);
  const qualityGateCommands = args.commands
    ? parseCommandList(args.commands)
    : [
        'yarn test:unit',
        'yarn test:integration:http',
        'yarn medusa db:migrate --check',
        'yarn security:validate-controls',
      ];

  console.log('Running pre-release quality gate checks...');

  qualityGateCommands.forEach(runCommand);

  console.log('\n✅ Quality gate passed: tests, migration checks, and security scans succeeded.');
}

main();
