import { createClient } from '@supabase/supabase-js';
import { ClientConfig, GlobalConfig, MonitoringConfig } from './schema';
import { Logger } from '../utils/logger';

export class DatabaseConfigError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

interface DatabaseClient {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: {
    clickup?: {
      listId?: string;
      assigneeId?: string;
    };
    ga4Monitoring?: {
      enabled?: boolean;
      propertyId?: string;
      timezone?: string;
      metrics?: {
        sessions?: boolean;
        totalUsers?: boolean;
        engagementRate?: boolean;
        conversions?: boolean;
        purchaseRevenue?: boolean;
      };
      keyEventName?: string;
      isEcommerce?: boolean;
      thresholds?: {
        warning?: number;
        critical?: number;
        minBaseline?: number;
      };
    };
  };
}

/**
 * Load monitoring configuration from Supabase database
 */
export async function loadConfigFromDatabase(
  supabaseUrl: string,
  supabaseServiceKey: string,
  logger: Logger
): Promise<MonitoringConfig> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  logger.info('Loading client configurations from database...');

  // Fetch all active clients with GA4 monitoring enabled
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, slug, is_active, settings')
    .eq('is_active', true);

  if (error) {
    throw new DatabaseConfigError('Failed to fetch clients from database', error);
  }

  if (!clients || clients.length === 0) {
    throw new DatabaseConfigError('No active clients found in database');
  }

  // Filter and transform clients with GA4 monitoring enabled
  const monitoringClients = (clients as DatabaseClient[])
    .filter(client => {
      const ga4Settings = client.settings?.ga4Monitoring;
      return ga4Settings?.enabled && ga4Settings?.propertyId;
    })
    .map(client => transformToClientConfig(client));

  if (monitoringClients.length === 0) {
    throw new DatabaseConfigError('No clients with GA4 monitoring enabled found');
  }

  logger.info(`Found ${monitoringClients.length} clients with GA4 monitoring enabled`);

  // Build the monitoring config
  const config: MonitoringConfig = {
    global: getDefaultGlobalConfig(),
    clients: monitoringClients
  };

  return config;
}

/**
 * Transform database client to monitoring ClientConfig
 */
function transformToClientConfig(dbClient: DatabaseClient): ClientConfig {
  const ga4 = dbClient.settings.ga4Monitoring!;
  const clickup = dbClient.settings.clickup;

  // Validate ClickUp settings
  if (!clickup?.listId) {
    throw new DatabaseConfigError(
      `Client "${dbClient.name}" has GA4 monitoring enabled but no ClickUp list configured`
    );
  }

  return {
    id: dbClient.id,
    name: dbClient.name,
    ga4PropertyId: ga4.propertyId!,
    timezone: ga4.timezone || 'Europe/Amsterdam',
    metrics: {
      sessions: ga4.metrics?.sessions ?? true,
      totalUsers: ga4.metrics?.totalUsers ?? true,
      engagementRate: ga4.metrics?.engagementRate ?? true,
      conversions: ga4.metrics?.conversions ?? false,
      purchaseRevenue: ga4.metrics?.purchaseRevenue ?? false
    },
    keyEventName: ga4.keyEventName,
    isEcommerce: ga4.isEcommerce ?? false,
    thresholds: ga4.thresholds ? {
      sessions: ga4.thresholds,
      totalUsers: ga4.thresholds,
      engagementRate: ga4.thresholds,
      conversions: ga4.thresholds,
      purchaseRevenue: ga4.thresholds
    } : undefined,
    clickup: {
      listId: clickup.listId,
      assigneeId: clickup.assigneeId,
      tags: ['ga4-alert', dbClient.slug]
    }
  };
}

/**
 * Get default global configuration
 */
function getDefaultGlobalConfig(): GlobalConfig {
  return {
    defaultThresholds: {
      warning: 20,
      critical: 40,
      minBaseline: 20
    },
    baselineWindowDays: 7,
    minDaysForPercentageAlerts: 3,
    rateLimiting: {
      requestsPerMinute: 60,
      retryAttempts: 2,
      retryDelayMs: 1000
    }
  };
}
