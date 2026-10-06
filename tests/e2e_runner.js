#!/usr/bin/env node

/**
 * Master E2E Test Runner for Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * 
 * Usage:
 *   node tests/e2e_runner.js                  # Run all tests (Pretty format)
 *   node tests/e2e_runner.js --tier=1         # Run only Tier 1
 *   node tests/e2e_runner.js --format=tap     # Output TAP 13 for CI
 *   node tests/e2e_runner.js --format=json    # Output structured JSON
 *   node tests/e2e_runner.js --milestone=m1   # Run Milestone 1 relevant tests
 */

const path = require('node:path');
const { Reporter } = require('./lib/reporter.js');
const { runTier1 } = require('./suites/tier1_features.js');
const { runTier2 } = require('./suites/tier2_boundaries.js');
const { runTier3 } = require('./suites/tier3_combinations.js');
const { runTier4 } = require('./suites/tier4_scenarios.js');
const { runTier1Secrets, runTier2Secrets } = require('./tier1_secrets_features.test.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'pretty',
    tier: 'all',
    milestone: null,
    summaryOnly: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--tier=')) {
      options.tier = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--milestone=')) {
      options.milestone = arg.split('=')[1].toLowerCase();
    } else if (arg === '--summary') {
      options.summaryOnly = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Tucson Hybrid Trunk Prevention Website - E2E Test Runner

Options:
  --tier=1|2|3|4|all       Run specific test tier (default: all)
  --format=pretty|tap|json Output formatting mode (default: pretty)
  --milestone=m1|m2|m3|m4  Run tests scoped to specific milestone
  --summary                Display only the summary section
  --help, -h               Show this help message

Examples:
  node tests/e2e_runner.js
  node tests/e2e_runner.js --tier=1 --format=tap
  node tests/e2e_runner.js --format=json > test-results.json
`);
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const rootDir = path.resolve(__dirname, '..');
  const reporter = new Reporter(options.format);
  const context = { rootDir, reporter, options };

  const shouldRunTier1 = options.tier === 'all' || options.tier === '1' || options.tier === 'tier1';
  const shouldRunTier2 = options.tier === 'all' || options.tier === '2' || options.tier === 'tier2';
  const shouldRunTier3 = options.tier === 'all' || options.tier === '3' || options.tier === 'tier3';
  const shouldRunTier4 = options.tier === 'all' || options.tier === '4' || options.tier === 'tier4';

  if (shouldRunTier1) {
    runTier1(context);
    runTier1Secrets(context);
  }

  if (shouldRunTier2) {
    runTier2(context);
    runTier2Secrets(context);
  }

  if (shouldRunTier3) {
    runTier3(context);
  }

  if (shouldRunTier4) {
    runTier4(context);
  }

  const output = reporter.generateOutput();
  console.log(output);

  const hasFailures = reporter.results.some(r => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
