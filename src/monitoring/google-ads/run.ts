#!/usr/bin/env npx tsx
/**
 * Google Ads Monitoring CLI
 *
 * Usage:
 *   npx tsx src/monitoring/google-ads/run.ts          # Production run
 *   npx tsx src/monitoring/google-ads/run.ts --dry    # Dry run (no alerts created)
 *   npx tsx src/monitoring/google-ads/run.ts --debug  # Debug logging
 */

import { runGoogleAdsMonitoring } from './monitor';
import type { LogLevel } from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry') || args.includes('--dry-run');
  const debug = args.includes('--debug');

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Google Ads Monitoring Runner         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No alerts will be created');
    console.log('');
  }

  const logLevel: LogLevel = debug ? 'debug' : 'info';

  try {
    const result = await runGoogleAdsMonitoring({
      dryRun,
      logLevel,
    });

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('               SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Success:          ${result.success ? '✅' : '❌'}`);
    console.log(`Clients:          ${result.clientsProcessed}`);
    console.log(`Checks run:       ${result.checksRun}`);
    console.log(`Alerts created:   ${result.alertsCreated}`);
    console.log(`Alerts skipped:   ${result.alertsSkipped}`);
    console.log(`Errors:           ${result.errors.length}`);
    console.log('');

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Monitoring failed with error:');
    console.error((error as Error).message);
    console.error('');
    process.exit(1);
  }
}

main();
