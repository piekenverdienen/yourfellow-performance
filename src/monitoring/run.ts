#!/usr/bin/env node

/**
 * GA4 Anomaly Monitoring CLI
 *
 * Usage:
 *   npx ts-node src/monitoring/run.ts --config ./config/monitoring.json
 *   npx ts-node src/monitoring/run.ts --config ./config/monitoring.json --dry-run
 *   npx ts-node src/monitoring/run.ts --config ./config/monitoring.json --log-level debug
 */

import { GA4AnomalyMonitor, LogLevel } from './index';

interface CLIArgs {
  config: string;
  dryRun: boolean;
  logLevel: LogLevel;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    config: './config/monitoring.json',
    dryRun: false,
    logLevel: 'info',
    help: false
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--config':
      case '-c':
        args.config = argv[++i];
        break;
      case '--dry-run':
      case '-d':
        args.dryRun = true;
        break;
      case '--log-level':
      case '-l':
        args.logLevel = argv[++i] as LogLevel;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
GA4 Anomaly Monitoring Service

Usage:
  npx ts-node src/monitoring/run.ts [options]

Options:
  -c, --config <path>      Path to config file (default: ./config/monitoring.json)
  -d, --dry-run            Run without creating ClickUp tasks
  -l, --log-level <level>  Log level: debug, info, warn, error (default: info)
  -h, --help               Show this help message

Environment Variables:
  GA4_CREDENTIALS          JSON string of Google service account credentials
  CLICKUP_TOKEN            ClickUp API token
  STORE_PATH               Path to fingerprint store (default: ./data/fingerprints.json)
  DRY_RUN                  Set to 'true' for dry run mode

Examples:
  # Run with default config
  npx ts-node src/monitoring/run.ts

  # Dry run with debug logging
  npx ts-node src/monitoring/run.ts --dry-run --log-level debug

  # Use custom config
  npx ts-node src/monitoring/run.ts --config /path/to/config.json
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     GA4 Anomaly Monitoring Service        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  try {
    const monitor = new GA4AnomalyMonitor({
      configPath: args.config,
      dryRun: args.dryRun,
      logLevel: args.logLevel
    });

    const result = await monitor.run();

    // Exit with error code if there were failures
    if (!result.success) {
      process.exit(1);
    }

    console.log('');
    console.log('✅ Monitoring run completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Fatal error:', (error as Error).message);

    if (args.logLevel === 'debug') {
      console.error((error as Error).stack);
    }

    process.exit(1);
  }
}

main();
