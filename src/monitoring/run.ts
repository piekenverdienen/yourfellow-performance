#!/usr/bin/env node

/**
 * GA4 Anomaly Monitoring CLI
 *
 * Usage:
 *   npm run monitor                    # Run with database config (default)
 *   npm run monitor -- --source file   # Run with file config
 *   npm run monitor:dry                # Dry run mode
 *   npm run monitor:debug              # Debug logging
 */

import { GA4AnomalyMonitor, LogLevel } from './index';

interface CLIArgs {
  source: 'database' | 'file';
  dryRun: boolean;
  logLevel: LogLevel;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    source: 'database',
    dryRun: false,
    logLevel: 'info',
    help: false
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--source':
      case '-s':
        args.source = argv[++i] as 'database' | 'file';
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
  npm run monitor [options]

Options:
  -s, --source <type>      Config source: database (default) or file
  -d, --dry-run            Run without creating ClickUp tasks
  -l, --log-level <level>  Log level: debug, info, warn, error (default: info)
  -h, --help               Show this help message

Environment Variables:
  CONFIG_SOURCE            Config source: database (default) or file

  # For database config (default):
  NEXT_PUBLIC_SUPABASE_URL Supabase project URL
  SUPABASE_SERVICE_KEY     Supabase service role key

  # For file config:
  CONFIG_PATH              Path to config file (default: ./config/monitoring.json)

  # Required for both:
  GA4_CREDENTIALS          JSON string of Google service account credentials
  CLICKUP_TOKEN            ClickUp API token
  STORE_PATH               Path to fingerprint store (default: ./data/fingerprints.json)
  DRY_RUN                  Set to 'true' for dry run mode

Examples:
  # Run with database config (clients from Supabase)
  npm run monitor

  # Run with file config
  npm run monitor -- --source file

  # Dry run with debug logging
  npm run monitor:dry -- --log-level debug
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Override CONFIG_SOURCE from CLI arg
  if (args.source) {
    process.env.CONFIG_SOURCE = args.source;
  }

  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     GA4 Anomaly Monitoring Service        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  try {
    const monitor = await GA4AnomalyMonitor.create({
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
