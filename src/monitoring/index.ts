import {
  loadConfig,
  loadEnvConfig,
  loadConfigFromDatabase,
  getEffectiveThresholds,
  getEnabledMetrics,
  MonitoringConfig,
  EnvConfig,
  ClientConfig
} from './config';
import { GA4Client, GA4ClientError, MetricDataset } from './ga4';
import { evaluateMetric, AnomalyResult, ClientEvaluationSummary } from './evaluator';
import { ClickUpClient, AlertData, TaskCreationResult } from './clickup';
import { FingerprintStore } from './store';
import { createLogger, Logger, LogLevel } from './utils/logger';

export interface MonitoringOptions {
  dryRun?: boolean;
  logLevel?: LogLevel;
}

export interface MonitoringRunResult {
  success: boolean;
  clientsProcessed: number;
  anomaliesFound: number;
  alertsCreated: number;
  alertsSkipped: number;
  errors: string[];
  summaries: ClientEvaluationSummary[];
}

/**
 * Main GA4 Anomaly Monitoring orchestrator
 */
export class GA4AnomalyMonitor {
  private config: MonitoringConfig;
  private envConfig: EnvConfig;
  private ga4Client: GA4Client;
  private clickupClient: ClickUpClient;
  private fingerprintStore: FingerprintStore;
  private logger: Logger;
  private dryRun: boolean;

  private constructor(
    config: MonitoringConfig,
    envConfig: EnvConfig,
    logger: Logger,
    dryRun: boolean
  ) {
    this.config = config;
    this.envConfig = envConfig;
    this.logger = logger;
    this.dryRun = dryRun;

    // Initialize clients
    this.ga4Client = new GA4Client({
      credentials: this.envConfig.GA4_CREDENTIALS,
      logger: this.logger,
      retryAttempts: this.config.global.rateLimiting.retryAttempts,
      retryDelayMs: this.config.global.rateLimiting.retryDelayMs
    });

    this.clickupClient = new ClickUpClient({
      token: this.envConfig.CLICKUP_TOKEN,
      logger: this.logger,
      retryAttempts: this.config.global.rateLimiting.retryAttempts,
      retryDelayMs: this.config.global.rateLimiting.retryDelayMs
    });

    this.fingerprintStore = new FingerprintStore(
      this.envConfig.STORE_PATH,
      this.logger
    );

    this.logger.info(`Loaded ${this.config.clients.length} client configurations`);
  }

  /**
   * Create a new GA4AnomalyMonitor instance
   * Automatically chooses between database and file config based on CONFIG_SOURCE
   */
  static async create(options: MonitoringOptions = {}): Promise<GA4AnomalyMonitor> {
    const logger = createLogger(options.logLevel ?? 'info');
    const envConfig = loadEnvConfig();

    let dryRun = options.dryRun ?? false;
    if (envConfig.DRY_RUN) {
      dryRun = true;
    }

    if (dryRun) {
      logger.info('🔍 DRY RUN MODE - No ClickUp tasks will be created');
    }

    logger.info('Loading configuration...');

    let config: MonitoringConfig;

    if (envConfig.CONFIG_SOURCE === 'database') {
      logger.info('Loading client config from database...');
      config = await loadConfigFromDatabase(
        envConfig.SUPABASE_URL!,
        envConfig.SUPABASE_SERVICE_KEY!,
        logger
      );
    } else {
      logger.info(`Loading client config from file: ${envConfig.CONFIG_PATH}`);
      config = loadConfig(envConfig.CONFIG_PATH);
    }

    return new GA4AnomalyMonitor(config, envConfig, logger, dryRun);
  }

  /**
   * Run the monitoring for all clients
   */
  async run(): Promise<MonitoringRunResult> {
    const result: MonitoringRunResult = {
      success: true,
      clientsProcessed: 0,
      anomaliesFound: 0,
      alertsCreated: 0,
      alertsSkipped: 0,
      errors: [],
      summaries: []
    };

    this.logger.info('Starting GA4 anomaly monitoring run...');

    // Cleanup old fingerprints
    this.fingerprintStore.cleanup(30);

    // Process each client
    for (const clientConfig of this.config.clients) {
      try {
        const summary = await this.processClient(clientConfig);
        result.summaries.push(summary);
        result.clientsProcessed++;
        result.anomaliesFound += summary.anomaliesFound;

        // Create alerts for anomalies
        for (const anomaly of summary.results.filter(r => r.severity !== null)) {
          const alertResult = await this.handleAnomaly(anomaly, clientConfig);

          if (alertResult.skipped) {
            result.alertsSkipped++;
          } else if (alertResult.success) {
            result.alertsCreated++;
          } else {
            result.errors.push(alertResult.error || 'Unknown error');
          }
        }

      } catch (error) {
        const errorMessage = (error as Error).message;
        result.errors.push(`Client ${clientConfig.name}: ${errorMessage}`);
        this.logger.error(`Failed to process client: ${clientConfig.name}`, {
          error: errorMessage
        });

        // Create internal error alert
        if (!this.dryRun && this.config.global.clickup?.errorAlertListId) {
          await this.clickupClient.createErrorAlert(
            this.config.global.clickup.errorAlertListId,
            errorMessage,
            { clientId: clientConfig.id, clientName: clientConfig.name }
          );
        }
      }
    }

    // Save fingerprints
    this.fingerprintStore.save();

    // Determine overall success
    result.success = result.errors.length === 0;

    this.logSummary(result);

    return result;
  }

  /**
   * Process a single client
   */
  private async processClient(clientConfig: ClientConfig): Promise<ClientEvaluationSummary> {
    const clientLogger = this.logger.child({ client: clientConfig.name });
    clientLogger.info(`Processing client: ${clientConfig.name}`);

    const enabledMetrics = getEnabledMetrics(clientConfig);
    clientLogger.debug(`Enabled metrics: ${enabledMetrics.join(', ')}`);

    // Fetch GA4 data
    const datasets = await this.ga4Client.fetchClientData(
      clientConfig,
      this.config.global,
      enabledMetrics
    );

    // Evaluate each metric
    const results: AnomalyResult[] = [];
    for (const dataset of datasets) {
      const thresholds = getEffectiveThresholds(
        this.config.global,
        clientConfig,
        dataset.metric
      );

      const result = evaluateMetric(dataset, {
        globalConfig: this.config.global,
        clientConfig,
        thresholds
      });

      results.push(result);

      if (result.severity) {
        clientLogger.warn(`Anomaly detected: ${result.metric}`, {
          severity: result.severity,
          baseline: result.baseline,
          actual: result.actual,
          deltaPct: result.deltaPct
        });
      }
    }

    const anomalies = results.filter(r => r.severity !== null);

    return {
      clientId: clientConfig.id,
      clientName: clientConfig.name,
      metricsEvaluated: results.length,
      anomaliesFound: anomalies.length,
      criticalCount: anomalies.filter(r => r.severity === 'CRITICAL').length,
      warningCount: anomalies.filter(r => r.severity === 'WARNING').length,
      results
    };
  }

  /**
   * Handle an anomaly - create ClickUp task if not duplicate
   */
  private async handleAnomaly(
    anomaly: AnomalyResult,
    clientConfig: ClientConfig
  ): Promise<TaskCreationResult> {
    // Check for duplicate
    if (this.fingerprintStore.exists(
      anomaly.clientId,
      anomaly.metric,
      anomaly.date,
      anomaly.severity!
    )) {
      this.logger.debug(`Skipping duplicate alert: ${anomaly.clientId}:${anomaly.metric}:${anomaly.date}`);
      return {
        success: true,
        skipped: true,
        skipReason: 'duplicate'
      };
    }

    // Build alert data
    const alertData: AlertData = {
      clientId: anomaly.clientId,
      clientName: anomaly.clientName,
      metric: anomaly.metric,
      date: anomaly.date,
      severity: anomaly.severity!,
      baseline: anomaly.baseline,
      actual: anomaly.actual,
      deltaPct: anomaly.deltaPct,
      direction: anomaly.direction,
      diagnosisHint: anomaly.diagnosisHint,
      checklistItems: anomaly.checklistItems,
      ga4PropertyId: clientConfig.ga4PropertyId
    };

    // Dry run - don't create task
    if (this.dryRun) {
      const taskTitle = this.clickupClient.buildTaskTitle(alertData);
      this.logger.info(`[DRY RUN] Would create task: ${taskTitle}`);

      // Still store fingerprint in dry run to track what would be created
      this.fingerprintStore.set(
        anomaly.clientId,
        anomaly.metric,
        anomaly.date,
        anomaly.severity!,
        'dry-run',
        'dry-run'
      );

      return {
        success: true,
        skipped: true,
        skipReason: 'dry_run'
      };
    }

    // Create ClickUp task
    const result = await this.clickupClient.createTask(
      clientConfig.clickup.listId,
      alertData,
      clientConfig.clickup.assigneeId,
      clientConfig.clickup.tags
    );

    // Store fingerprint on success
    if (result.success) {
      this.fingerprintStore.set(
        anomaly.clientId,
        anomaly.metric,
        anomaly.date,
        anomaly.severity!,
        result.taskId,
        result.taskUrl
      );
    }

    return result;
  }

  /**
   * Log final summary
   */
  private logSummary(result: MonitoringRunResult): void {
    this.logger.info('═══════════════════════════════════════');
    this.logger.info('         MONITORING RUN COMPLETE');
    this.logger.info('═══════════════════════════════════════');
    this.logger.info(`Clients processed:  ${result.clientsProcessed}`);
    this.logger.info(`Anomalies found:    ${result.anomaliesFound}`);
    this.logger.info(`Alerts created:     ${result.alertsCreated}`);
    this.logger.info(`Alerts skipped:     ${result.alertsSkipped}`);
    this.logger.info(`Errors:             ${result.errors.length}`);

    if (result.errors.length > 0) {
      this.logger.warn('Errors encountered:');
      for (const error of result.errors) {
        this.logger.warn(`  - ${error}`);
      }
    }

    // Per-client summary
    for (const summary of result.summaries) {
      const status = summary.anomaliesFound > 0 ? '⚠️' : '✅';
      this.logger.info(
        `${status} ${summary.clientName}: ${summary.metricsEvaluated} metrics, ` +
        `${summary.criticalCount} critical, ${summary.warningCount} warnings`
      );
    }
  }
}

// Export all modules
export * from './config';
export * from './ga4';
export * from './evaluator';
export * from './clickup';
export * from './store';
export * from './utils/logger';
