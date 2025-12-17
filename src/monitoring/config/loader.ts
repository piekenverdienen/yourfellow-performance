import { readFileSync, existsSync } from 'fs';
import { MonitoringConfig, EnvConfig, GlobalConfig, ClientConfig, ThresholdConfig, MetricType } from './schema';

export class ConfigError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load and validate monitoring configuration from JSON file
 */
export function loadConfig(configPath: string): MonitoringConfig {
  if (!existsSync(configPath)) {
    throw new ConfigError(`Config file not found: ${configPath}`);
  }

  let rawConfig: unknown;
  try {
    const content = readFileSync(configPath, 'utf-8');
    rawConfig = JSON.parse(content);
  } catch (error) {
    throw new ConfigError(`Failed to parse config file: ${configPath}`, error);
  }

  const result = MonitoringConfig.safeParse(rawConfig);
  if (!result.success) {
    throw new ConfigError('Invalid configuration', result.error.format());
  }

  return result.data;
}

/**
 * Load and validate environment variables
 */
export function loadEnvConfig(): EnvConfig {
  const result = EnvConfig.safeParse({
    CONFIG_SOURCE: process.env.CONFIG_SOURCE,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    CONFIG_PATH: process.env.CONFIG_PATH,
    GA4_CREDENTIALS: process.env.GA4_CREDENTIALS,
    CLICKUP_TOKEN: process.env.CLICKUP_TOKEN,
    STORE_PATH: process.env.STORE_PATH,
    DRY_RUN: process.env.DRY_RUN,
    LOG_LEVEL: process.env.LOG_LEVEL
  });

  if (!result.success) {
    throw new ConfigError('Invalid environment configuration', result.error.format());
  }

  return result.data;
}

/**
 * Get effective thresholds for a client/metric combination
 * Priority: client override > global default
 */
export function getEffectiveThresholds(
  globalConfig: GlobalConfig,
  clientConfig: ClientConfig,
  metric: MetricType
): ThresholdConfig {
  const globalDefaults: ThresholdConfig = {
    warning: globalConfig.defaultThresholds.warning,
    critical: globalConfig.defaultThresholds.critical,
    minBaseline: globalConfig.defaultThresholds.minBaseline
  };

  const clientOverride = clientConfig.thresholds?.[metric];
  if (!clientOverride) {
    return globalDefaults;
  }

  return {
    warning: clientOverride.warning ?? globalDefaults.warning,
    critical: clientOverride.critical ?? globalDefaults.critical,
    minBaseline: clientOverride.minBaseline ?? globalDefaults.minBaseline
  };
}

/**
 * Get list of enabled metrics for a client
 */
export function getEnabledMetrics(client: ClientConfig): MetricType[] {
  const metrics: MetricType[] = [];

  if (client.metrics.sessions) metrics.push('sessions');
  if (client.metrics.totalUsers) metrics.push('totalUsers');
  if (client.metrics.engagementRate) metrics.push('engagementRate');
  if (client.metrics.conversions) metrics.push('conversions');
  if (client.metrics.purchaseRevenue) metrics.push('purchaseRevenue');

  return metrics;
}
