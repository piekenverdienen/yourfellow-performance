import { createClient } from '@supabase/supabase-js';
import { GoogleAdsClient } from './client';
import { AlertEngine } from '../alerts';
import { GOOGLE_ADS_CHECKS } from '../checks/google-ads';
import { createLogger, Logger, LogLevel } from '../utils/logger';
import type {
  GoogleAdsCredentials,
  GoogleAdsMonitoringClientConfig,
  MonitoringRunResult,
  CheckResult,
} from './types';

export interface GoogleAdsMonitorOptions {
  dryRun?: boolean;
  logLevel?: LogLevel;
  checkIds?: string[]; // Run only specific checks
}

interface DatabaseClient {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: {
    googleAds?: {
      status: 'connected' | 'pending' | 'not_connected';
      customerId?: string;
      refreshToken?: string;
      monitoringEnabled?: boolean;
      lastCheckAt?: string;
      thresholds?: {
        noDeliveryHours?: number;
      };
    };
  };
}

/**
 * Google Ads Anomaly Monitor
 * Runs checks for all connected Google Ads accounts
 */
export class GoogleAdsMonitor {
  private logger: Logger;
  private alertEngine: AlertEngine;
  private credentials: GoogleAdsCredentials;
  private dryRun: boolean;
  private checkIds?: string[];
  private supabaseUrl: string;
  private supabaseServiceKey: string;

  constructor(options: GoogleAdsMonitorOptions = {}) {
    this.logger = createLogger(options.logLevel ?? 'info');
    this.dryRun = options.dryRun ?? false;
    this.checkIds = options.checkIds;

    // Load environment variables
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

    this.credentials = {
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refreshToken: '', // Will be set per client
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    };

    this.alertEngine = new AlertEngine({
      supabaseUrl: this.supabaseUrl,
      supabaseServiceKey: this.supabaseServiceKey,
      logger: this.logger,
    });

    if (this.dryRun) {
      this.logger.info('🔍 DRY RUN MODE - No alerts will be created');
    }
  }

  /**
   * Run monitoring for all connected clients
   */
  async run(): Promise<MonitoringRunResult> {
    const result: MonitoringRunResult = {
      success: true,
      clientsProcessed: 0,
      checksRun: 0,
      alertsCreated: 0,
      alertsSkipped: 0,
      errors: [],
    };

    this.logger.info('Starting Google Ads monitoring run...');

    // Load clients from database
    const clients = await this.loadConnectedClients();

    if (clients.length === 0) {
      this.logger.info('No clients with connected Google Ads found');
      return result;
    }

    this.logger.info(`Found ${clients.length} clients with Google Ads connected`);

    // Process each client
    for (const clientConfig of clients) {
      try {
        const clientResult = await this.processClient(clientConfig);

        result.clientsProcessed++;
        result.checksRun += clientResult.checksRun;
        result.alertsCreated += clientResult.alertsCreated;
        result.alertsSkipped += clientResult.alertsSkipped;
      } catch (error) {
        const errorMessage = `Client ${clientConfig.clientName}: ${(error as Error).message}`;
        result.errors.push(errorMessage);
        this.logger.error('Failed to process client', {
          clientName: clientConfig.clientName,
          error: (error as Error).message,
        });
      }
    }

    // Update last check timestamp for processed clients
    if (!this.dryRun) {
      await this.updateLastCheckTimestamp(clients.map(c => c.clientId));
    }

    result.success = result.errors.length === 0;
    this.logSummary(result);

    return result;
  }

  /**
   * Load clients with connected Google Ads from database
   */
  private async loadConnectedClients(): Promise<GoogleAdsMonitoringClientConfig[]> {
    const supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, slug, is_active, settings')
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to load clients', { error: error.message });
      throw error;
    }

    // Filter for connected clients with monitoring enabled
    return (clients as DatabaseClient[])
      .filter(client => {
        const googleAds = client.settings?.googleAds;
        return (
          googleAds?.status === 'connected' &&
          googleAds?.customerId &&
          googleAds?.refreshToken &&
          googleAds?.monitoringEnabled !== false
        );
      })
      .map(client => ({
        clientId: client.id,
        clientName: client.name,
        customerId: client.settings.googleAds!.customerId!,
        status: client.settings.googleAds!.status,
        credentials: {
          ...this.credentials,
          refreshToken: client.settings.googleAds!.refreshToken!,
        },
        thresholds: client.settings.googleAds!.thresholds,
      }));
  }

  /**
   * Process a single client
   */
  private async processClient(
    config: GoogleAdsMonitoringClientConfig
  ): Promise<{
    checksRun: number;
    alertsCreated: number;
    alertsSkipped: number;
  }> {
    const clientLogger = this.logger.child({ client: config.clientName });
    clientLogger.info(`Processing client: ${config.clientName}`);

    const client = new GoogleAdsClient({
      credentials: config.credentials,
      customerId: config.customerId,
      logger: clientLogger,
    });

    // Verify connection first
    const isConnected = await client.verifyConnection();
    if (!isConnected) {
      throw new Error('Failed to verify Google Ads connection');
    }

    let checksRun = 0;
    let alertsCreated = 0;
    let alertsSkipped = 0;

    // Get checks to run
    const checksToRun = this.checkIds
      ? GOOGLE_ADS_CHECKS.filter(check => this.checkIds!.includes(check.id))
      : GOOGLE_ADS_CHECKS;

    // Run each check
    for (const check of checksToRun) {
      try {
        clientLogger.debug(`Running check: ${check.name}`);

        const result = await check.run(client, config, clientLogger);
        checksRun++;

        if (result.status === 'ok') {
          // Auto-resolve any existing alerts for this check
          if (!this.dryRun) {
            await this.alertEngine.autoResolveIfFixed(
              config.clientId,
              'google_ads',
              check.id
            );
          }
          continue;
        }

        // Create alert for error/warning results
        if (result.alertData) {
          if (this.dryRun) {
            clientLogger.info(`[DRY RUN] Would create alert: ${result.alertData.title}`);
            alertsSkipped++;
          } else {
            const alertResult = await this.alertEngine.createAlertFromCheckResult(
              config.clientId,
              config.clientName,
              'google_ads',
              result
            );

            if (alertResult.success && !alertResult.skipped) {
              alertsCreated++;
            } else if (alertResult.skipped) {
              alertsSkipped++;
            }
          }
        }
      } catch (error) {
        clientLogger.error(`Check ${check.id} failed`, {
          error: (error as Error).message,
        });
        // Continue with other checks
      }
    }

    return { checksRun, alertsCreated, alertsSkipped };
  }

  /**
   * Update last check timestamp for clients
   */
  private async updateLastCheckTimestamp(clientIds: string[]): Promise<void> {
    const supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);

    for (const clientId of clientIds) {
      // Get current settings
      const { data: client } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single();

      if (!client) continue;

      const settings = client.settings as Record<string, unknown>;
      const googleAds = (settings.googleAds || {}) as Record<string, unknown>;

      await supabase
        .from('clients')
        .update({
          settings: {
            ...settings,
            googleAds: {
              ...googleAds,
              lastCheckAt: new Date().toISOString(),
            },
          },
        })
        .eq('id', clientId);
    }
  }

  /**
   * Log run summary
   */
  private logSummary(result: MonitoringRunResult): void {
    this.logger.info('═══════════════════════════════════════');
    this.logger.info('      GOOGLE ADS MONITORING COMPLETE');
    this.logger.info('═══════════════════════════════════════');
    this.logger.info(`Clients processed:  ${result.clientsProcessed}`);
    this.logger.info(`Checks run:         ${result.checksRun}`);
    this.logger.info(`Alerts created:     ${result.alertsCreated}`);
    this.logger.info(`Alerts skipped:     ${result.alertsSkipped}`);
    this.logger.info(`Errors:             ${result.errors.length}`);

    if (result.errors.length > 0) {
      this.logger.warn('Errors encountered:');
      for (const error of result.errors) {
        this.logger.warn(`  - ${error}`);
      }
    }
  }
}

/**
 * Run Google Ads monitoring (for CLI or cron)
 */
export async function runGoogleAdsMonitoring(
  options: GoogleAdsMonitorOptions = {}
): Promise<MonitoringRunResult> {
  const monitor = new GoogleAdsMonitor(options);
  return monitor.run();
}
