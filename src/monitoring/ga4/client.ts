import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { ClientConfig, MetricType, GlobalConfig } from '../config';
import {
  MetricDataset,
  MetricDataPoint,
  GA4_METRIC_MAPPING,
  formatGA4Date
} from './types';
import { Logger } from '../utils/logger';

export class GA4ClientError extends Error {
  constructor(message: string, public propertyId: string, public details?: unknown) {
    super(message);
    this.name = 'GA4ClientError';
  }
}

interface GA4ClientOptions {
  credentials: string; // JSON string of service account credentials
  logger: Logger;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class GA4Client {
  private client: BetaAnalyticsDataClient;
  private logger: Logger;
  private retryAttempts: number;
  private retryDelayMs: number;

  constructor(options: GA4ClientOptions) {
    const credentials = JSON.parse(options.credentials);
    this.client = new BetaAnalyticsDataClient({ credentials });
    this.logger = options.logger;
    this.retryAttempts = options.retryAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Calculate yesterday's date in the client's timezone
   */
  private getYesterdayDate(timezone: string): Date {
    const now = new Date();
    // Create date string in target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now);
    const today = new Date(todayStr + 'T00:00:00');
    today.setDate(today.getDate() - 1);
    return today;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Fetch data for a single client
   */
  async fetchClientData(
    clientConfig: ClientConfig,
    globalConfig: GlobalConfig,
    enabledMetrics: MetricType[]
  ): Promise<MetricDataset[]> {
    const yesterday = this.getYesterdayDate(clientConfig.timezone);
    const baselineStart = new Date(yesterday);
    baselineStart.setDate(baselineStart.getDate() - globalConfig.baselineWindowDays);

    const propertyId = `properties/${clientConfig.ga4PropertyId}`;

    this.logger.debug(`Fetching GA4 data for ${clientConfig.name}`, {
      propertyId: clientConfig.ga4PropertyId,
      yesterday: this.formatDate(yesterday),
      baselineStart: this.formatDate(baselineStart),
      metrics: enabledMetrics
    });

    const datasets: MetricDataset[] = [];

    // Separate conversions (needs event filter) from other metrics
    const standardMetrics = enabledMetrics.filter(m => m !== 'conversions');
    const hasConversions = enabledMetrics.includes('conversions');

    // Fetch standard metrics in one query
    if (standardMetrics.length > 0) {
      const standardData = await this.fetchMetricsWithRetry(
        propertyId,
        standardMetrics,
        this.formatDate(baselineStart),
        this.formatDate(yesterday),
        undefined
      );

      for (const metric of standardMetrics) {
        const metricData = standardData.get(metric) || [];
        datasets.push(this.buildDataset(clientConfig.id, metric, metricData, yesterday));
      }
    }

    // Fetch conversions separately with event filter
    if (hasConversions && clientConfig.keyEventName) {
      const conversionData = await this.fetchMetricsWithRetry(
        propertyId,
        ['conversions'],
        this.formatDate(baselineStart),
        this.formatDate(yesterday),
        clientConfig.keyEventName
      );

      const metricData = conversionData.get('conversions') || [];
      datasets.push(this.buildDataset(clientConfig.id, 'conversions', metricData, yesterday));
    }

    return datasets;
  }

  /**
   * Fetch metrics with retry logic
   */
  private async fetchMetricsWithRetry(
    propertyId: string,
    metrics: MetricType[],
    startDate: string,
    endDate: string,
    eventFilter?: string
  ): Promise<Map<MetricType, MetricDataPoint[]>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.fetchMetrics(propertyId, metrics, startDate, endDate, eventFilter);
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(`GA4 request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            error: lastError.message
          });
          await this.sleep(delay);
        }
      }
    }

    throw new GA4ClientError(
      `Failed to fetch GA4 data after ${this.retryAttempts + 1} attempts`,
      propertyId,
      lastError
    );
  }

  /**
   * Execute GA4 Data API query
   */
  private async fetchMetrics(
    propertyId: string,
    metrics: MetricType[],
    startDate: string,
    endDate: string,
    eventFilter?: string
  ): Promise<Map<MetricType, MetricDataPoint[]>> {
    const metricSpecs = metrics.map(m => ({
      name: GA4_METRIC_MAPPING[m]
    }));

    const request: Parameters<typeof this.client.runReport>[0] = {
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: metricSpecs,
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    };

    // Add event filter for conversions
    if (eventFilter) {
      request.dimensionFilter = {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: eventFilter }
        }
      };
    }

    const [response] = await this.client.runReport(request);
    const result = new Map<MetricType, MetricDataPoint[]>();

    // Initialize empty arrays for each metric
    for (const metric of metrics) {
      result.set(metric, []);
    }

    if (!response.rows) {
      return result;
    }

    // Process rows
    for (const row of response.rows) {
      const date = row.dimensionValues?.[0]?.value;
      if (!date) continue;

      const formattedDate = formatGA4Date(date);

      for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i];
        const value = parseFloat(row.metricValues?.[i]?.value || '0');

        result.get(metric)!.push({
          metric,
          date: formattedDate,
          value
        });
      }
    }

    return result;
  }

  /**
   * Build dataset from metric data points
   */
  private buildDataset(
    clientId: string,
    metric: MetricType,
    dataPoints: MetricDataPoint[],
    yesterday: Date
  ): MetricDataset {
    const yesterdayStr = this.formatDate(yesterday);

    // Find yesterday's data
    const yesterdayData = dataPoints.find(d => d.date === yesterdayStr);
    const baselineData = dataPoints.filter(d => d.date !== yesterdayStr);

    return {
      clientId,
      metric,
      yesterday: yesterdayData || { metric, date: yesterdayStr, value: 0 },
      baselineData,
      daysAvailable: baselineData.length + (yesterdayData ? 1 : 0)
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
