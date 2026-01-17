import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface PerformanceMetrics {
  conversions: number;
  conversionsValue: number;
  cost: number;
  clicks: number;
  impressions: number;
}

interface PerformanceRow {
  metrics: {
    conversions: string;
    conversionsValue: string;
    costMicros: string;
    clicks: string;
    impressions: string;
  };
}

/**
 * Check for significant performance drops
 *
 * This check compares key metrics from the last 7 days vs the previous 7 days:
 * - Conversions drop >= 25% triggers warning
 * - Conversions drop >= 50% triggers critical
 * - No conversions when there were conversions before triggers critical
 */
export class PerformanceDropCheck extends BaseGoogleAdsCheck {
  id = 'performance_drop';
  name = 'Performance Daling';
  description = 'Detecteert significante dalingen in conversies ten opzichte van de vorige periode';

  // Configurable thresholds
  private static WARNING_THRESHOLD = 0.25; // 25% drop
  private static CRITICAL_THRESHOLD = 0.50; // 50% drop

  private static GAQL_CURRENT_PERIOD = `
    SELECT
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM customer
    WHERE segments.date DURING LAST_7_DAYS
  `;

  private static GAQL_PREVIOUS_PERIOD = `
    SELECT
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM customer
    WHERE segments.date DURING LAST_14_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Get current period metrics (last 7 days)
      const currentResponse = await client.query(PerformanceDropCheck.GAQL_CURRENT_PERIOD);
      const currentMetrics = this.aggregateMetrics(currentResponse.results as unknown as PerformanceRow[]);

      // Get last 14 days metrics (to calculate previous 7 days)
      const fullResponse = await client.query(PerformanceDropCheck.GAQL_PREVIOUS_PERIOD);
      const fullMetrics = this.aggregateMetrics(fullResponse.results as unknown as PerformanceRow[]);

      // Calculate previous period (last 14 days minus last 7 days)
      const previousMetrics: PerformanceMetrics = {
        conversions: fullMetrics.conversions - currentMetrics.conversions,
        conversionsValue: fullMetrics.conversionsValue - currentMetrics.conversionsValue,
        cost: fullMetrics.cost - currentMetrics.cost,
        clicks: fullMetrics.clicks - currentMetrics.clicks,
        impressions: fullMetrics.impressions - currentMetrics.impressions,
      };

      // Skip if previous period had no conversions (nothing to compare)
      if (previousMetrics.conversions === 0) {
        logger.debug('No conversions in previous period, skipping check');
        return this.okResult({
          message: 'Geen conversies in vorige periode om mee te vergelijken',
          currentConversions: currentMetrics.conversions,
          previousConversions: previousMetrics.conversions,
        });
      }

      // Calculate percentage change
      const conversionChange = (currentMetrics.conversions - previousMetrics.conversions) / previousMetrics.conversions;
      const conversionChangePercent = Math.round(conversionChange * 100);

      // Check for "no conversions" scenario (was delivering, now zero)
      if (currentMetrics.conversions === 0 && previousMetrics.conversions > 0) {
        logger.warn(`No conversions in current period for ${config.clientName}`, {
          previousConversions: previousMetrics.conversions,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: geen conversies meer',
            shortDescription: `0 conversies in de afgelopen 7 dagen (was ${previousMetrics.conversions.toFixed(0)} vorige week)`,
            impact: `Er zijn geen conversies geweest in de afgelopen 7 dagen. Vorige week waren er ${previousMetrics.conversions.toFixed(0)} conversies. Dit wijst op een ernstig probleem.`,
            suggestedActions: [
              'Controleer of conversie tracking correct werkt',
              'Check of campagnes nog actief zijn en budget hebben',
              'Bekijk of er biedingen te laag zijn ingesteld',
              'Controleer of landingspaginas werken',
              'Analyseer of er marktveranderingen zijn',
            ],
            severity: 'critical',
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            changePercent: -100,
          }
        );
      }

      // Check for significant drop
      if (conversionChange <= -PerformanceDropCheck.CRITICAL_THRESHOLD) {
        logger.warn(`Critical performance drop for ${config.clientName}`, {
          changePercent: conversionChangePercent,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: ernstige performance daling',
            shortDescription: `Conversies ${conversionChangePercent}% t.o.v. vorige week`,
            impact: `Conversies zijn gedaald van ${previousMetrics.conversions.toFixed(1)} naar ${currentMetrics.conversions.toFixed(1)} (${conversionChangePercent}%). Dit is een kritieke daling die onmiddellijke actie vereist.`,
            suggestedActions: [
              'Analyseer welke campagnes het meest zijn gedaald',
              'Controleer of er budgetlimieten zijn bereikt',
              'Bekijk of er negatieve wijzigingen zijn in kwaliteitsscores',
              'Check concurrentiedruk en marktomstandigheden',
              'Vergelijk met seizoenspatronen',
            ],
            severity: 'critical',
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            changePercent: conversionChangePercent,
          }
        );
      }

      if (conversionChange <= -PerformanceDropCheck.WARNING_THRESHOLD) {
        logger.info(`Performance drop warning for ${config.clientName}`, {
          changePercent: conversionChangePercent,
        });

        return this.warningResult(
          1,
          {
            title: 'Google Ads: performance daling',
            shortDescription: `Conversies ${conversionChangePercent}% t.o.v. vorige week`,
            impact: `Conversies zijn gedaald van ${previousMetrics.conversions.toFixed(1)} naar ${currentMetrics.conversions.toFixed(1)} (${conversionChangePercent}%). Hoewel dit nog geen kritieke situatie is, verdient het aandacht.`,
            suggestedActions: [
              'Bekijk welke campagnes of ad groups de grootste daling tonen',
              'Analyseer of dit past bij een seizoenspatroon',
              'Controleer recente wijzigingen in campagnes',
              'Monitor de trend de komende dagen',
            ],
            severity: 'high',
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            changePercent: conversionChangePercent,
          }
        );
      }

      // No significant drop
      logger.debug(`No performance drop detected for ${config.clientName}`, {
        changePercent: conversionChangePercent,
      });

      return this.okResult({
        message: 'Geen significante performance daling',
        currentConversions: currentMetrics.conversions,
        previousConversions: previousMetrics.conversions,
        changePercent: conversionChangePercent,
      });
    } catch (error) {
      logger.error(`Error running ${this.id} check`, {
        error: (error as Error).message,
        clientName: config.clientName,
      });
      throw error;
    }
  }

  private aggregateMetrics(rows: PerformanceRow[]): PerformanceMetrics {
    return rows.reduce(
      (acc, row) => {
        acc.conversions += parseFloat(row.metrics?.conversions || '0');
        acc.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
        acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        acc.clicks += parseInt(row.metrics?.clicks || '0', 10);
        acc.impressions += parseInt(row.metrics?.impressions || '0', 10);
        return acc;
      },
      { conversions: 0, conversionsValue: 0, cost: 0, clicks: 0, impressions: 0 }
    );
  }
}
