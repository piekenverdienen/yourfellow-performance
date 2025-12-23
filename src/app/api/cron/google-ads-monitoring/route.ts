/**
 * Google Ads Monitoring Cron API
 *
 * This endpoint is called by Vercel Cron to run Google Ads monitoring checks.
 * It checks for disapproved ads, campaigns without delivery, and other issues.
 *
 * Schedule: Every 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { runGoogleAdsMonitoring } from '@/monitoring/google-ads';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized Google Ads monitoring request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting Google Ads monitoring job...');

    // Credentials are now loaded from app_settings database
    // No need to check environment variables

    // Run monitoring
    const result = await runGoogleAdsMonitoring({
      logLevel: 'info',
    });

    console.log('[Cron] Google Ads monitoring complete', {
      clientsProcessed: result.clientsProcessed,
      alertsCreated: result.alertsCreated,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      summary: {
        clientsProcessed: result.clientsProcessed,
        checksRun: result.checksRun,
        alertsCreated: result.alertsCreated,
        alertsSkipped: result.alertsSkipped,
        errors: result.errors.length,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Google Ads monitoring job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
