import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface PerformanceMetrics {
  conversionsValue: number;
  cost: number;
  roas: number;
}

interface PerformanceRow {
  metrics: {
    conversionsValue: string;
    costMicros: string;
  };
}

/**
 * Check for significant ROAS (Return on Ad Spend) decreases
 *
 * Why this matters to media buyers:
 * - Declining ROAS means your ads are generating less revenue per euro spent
 * - Critical for e-commerce and lead-gen with monetary conversion values
 * - Indicates overall campaign profitability is at risk
 *
 * Thresholds:
 * - Warning: ROAS dropped by 20%+ vs previous period
 * - Critical: ROAS dropped by 35%+ vs previous period
 *
 * Minimum requirements:
 * - At least €100 in conversion value in current period (for meaningful ROAS)
 * - At least €50 spend in both periods (for valid comparison)
 */
export class RoasDecreaseCheck extends BaseGoogleAdsCheck {
  id = 'roas_decrease';
  name = 'ROAS Daling';
  description = 'Detecteert significante dalingen in Return on Ad Spend ten opzichte van de baseline';

  // Configurable thresholds
  private static WARNING_THRESHOLD = 0.20; // 20% decrease
  private static CRITICAL_THRESHOLD = 0.35; // 35% decrease
  private static MIN_CONVERSION_VALUE = 100; // Minimum €100 conversion value
  private static MIN_SPEND = 50; // Minimum €50 spend

  private static GAQL_CURRENT_PERIOD = `
    SELECT
      metrics.conversions_value,
      metrics.cost_micros
    FROM customer
    WHERE segments.date DURING LAST_7_DAYS
  `;

  private static GAQL_PREVIOUS_PERIOD = `
    SELECT
      metrics.conversions_value,
      metrics.cost_micros
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
      const currentResponse = await client.query(RoasDecreaseCheck.GAQL_CURRENT_PERIOD);
      const currentMetrics = this.aggregateMetrics(currentResponse.results as unknown as PerformanceRow[]);

      // Get last 14 days metrics (to calculate previous 7 days)
      const fullResponse = await client.query(RoasDecreaseCheck.GAQL_PREVIOUS_PERIOD);
      const fullMetrics = this.aggregateMetrics(fullResponse.results as unknown as PerformanceRow[]);

      // Calculate previous period (last 14 days minus last 7 days)
      const previousMetrics: PerformanceMetrics = {
        conversionsValue: fullMetrics.conversionsValue - currentMetrics.conversionsValue,
        cost: fullMetrics.cost - currentMetrics.cost,
        roas: 0,
      };
      previousMetrics.roas = previousMetrics.cost > 0
        ? previousMetrics.conversionsValue / previousMetrics.cost
        : 0;

      // Skip if no conversion value tracking (non-e-commerce accounts)
      if (currentMetrics.conversionsValue === 0 && previousMetrics.conversionsValue === 0) {
        logger.debug('No conversion value tracking detected, skipping ROAS check', {
          clientName: config.clientName,
        });
        return this.okResult({
          message: 'Geen conversiewaarde tracking aanwezig (niet van toepassing)',
          note: 'Deze check is alleen relevant voor accounts met monetaire conversiewaarden',
        });
      }

      // Skip if insufficient spend for valid comparison
      if (currentMetrics.cost < RoasDecreaseCheck.MIN_SPEND || previousMetrics.cost < RoasDecreaseCheck.MIN_SPEND) {
        logger.debug('Insufficient spend for ROAS comparison', {
          currentSpend: currentMetrics.cost,
          previousSpend: previousMetrics.cost,
          minRequired: RoasDecreaseCheck.MIN_SPEND,
        });
        return this.okResult({
          message: 'Te weinig uitgaven voor betrouwbare ROAS-analyse',
          currentSpend: currentMetrics.cost,
          previousSpend: previousMetrics.cost,
          minRequired: RoasDecreaseCheck.MIN_SPEND,
        });
      }

      // Skip if conversion value too low for meaningful ROAS
      if (currentMetrics.conversionsValue < RoasDecreaseCheck.MIN_CONVERSION_VALUE &&
          previousMetrics.conversionsValue < RoasDecreaseCheck.MIN_CONVERSION_VALUE) {
        logger.debug('Conversion value too low for meaningful ROAS analysis');
        return this.okResult({
          message: 'Conversiewaarde te laag voor zinvolle ROAS-analyse',
          currentValue: currentMetrics.conversionsValue,
          previousValue: previousMetrics.conversionsValue,
        });
      }

      // Calculate ROAS change (negative change = decrease)
      const roasChange = previousMetrics.roas > 0
        ? (currentMetrics.roas - previousMetrics.roas) / previousMetrics.roas
        : 0;
      const roasChangePercent = Math.round(roasChange * 100);

      // Calculate lost revenue potential
      const expectedRevenueAtOldRoas = currentMetrics.cost * previousMetrics.roas;
      const lostRevenue = expectedRevenueAtOldRoas - currentMetrics.conversionsValue;

      // Check for ROAS from positive to zero/negative (worst case)
      if (previousMetrics.roas > 1 && currentMetrics.roas < 0.5) {
        logger.warn(`ROAS collapsed for ${config.clientName}`, {
          currentRoas: currentMetrics.roas,
          previousRoas: previousMetrics.roas,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: ROAS ingestort',
            shortDescription: `ROAS gedaald van ${previousMetrics.roas.toFixed(2)} naar ${currentMetrics.roas.toFixed(2)}`,
            impact: `Je ROAS is dramatisch gedaald van ${previousMetrics.roas.toFixed(2)} naar ${currentMetrics.roas.toFixed(2)}. ` +
              `Dit betekent dat je per euro uitgaven nu slechts €${currentMetrics.roas.toFixed(2)} terugkrijgt. ` +
              `Geschatte gemiste omzet: €${Math.max(0, lostRevenue).toFixed(0)}. Urgente actie vereist.`,
            suggestedActions: [
              'Controleer ONMIDDELLIJK of conversietracking correct werkt',
              'Pauzeer campagnes met negatieve ROI om verdere verliezen te beperken',
              'Analyseer of er grote wijzigingen zijn in producten/prijzen/voorraad',
              'Bekijk of landingspaginas technische problemen hebben',
              'Controleer externe factoren (seizoen, marktveranderingen, concurrentie)',
              'Evalueer of je doelgroep targeting nog relevant is',
            ],
            severity: 'critical',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            roasChangePercent,
            lostRevenue: Math.max(0, lostRevenue),
          }
        );
      }

      // Check for critical ROAS decrease
      if (roasChange <= -RoasDecreaseCheck.CRITICAL_THRESHOLD) {
        logger.warn(`Critical ROAS decrease for ${config.clientName}`, {
          currentRoas: currentMetrics.roas,
          previousRoas: previousMetrics.roas,
          changePercent: roasChangePercent,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: ernstige ROAS daling',
            shortDescription: `ROAS ${roasChangePercent}% t.o.v. vorige week (${currentMetrics.roas.toFixed(2)} vs ${previousMetrics.roas.toFixed(2)})`,
            impact: `Je ROAS is gedaald van ${previousMetrics.roas.toFixed(2)} naar ${currentMetrics.roas.toFixed(2)}. ` +
              `Bij dezelfde uitgaven zou je met de oude ROAS €${expectedRevenueAtOldRoas.toFixed(0)} aan omzet verwachten, ` +
              `maar je realiseerde slechts €${currentMetrics.conversionsValue.toFixed(0)}. ` +
              `Dit is €${Math.max(0, lostRevenue).toFixed(0)} aan potentieel gemiste omzet.`,
            suggestedActions: [
              'Identificeer welke campagnes de grootste ROAS-daling tonen',
              'Analyseer of bepaalde producten of categorieën slecht presteren',
              'Controleer of je biedstrategieën (tROAS/tCPA) correct zijn ingesteld',
              'Bekijk of er prijswijzigingen of voorraadproblemen zijn',
              'Evalueer of de kwaliteit van verkeer is veranderd',
              'Vergelijk met historische patronen en seizoensinvloeden',
            ],
            severity: 'critical',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            roasChangePercent,
            lostRevenue: Math.max(0, lostRevenue),
          }
        );
      }

      // Check for warning ROAS decrease
      if (roasChange <= -RoasDecreaseCheck.WARNING_THRESHOLD) {
        logger.info(`ROAS decrease warning for ${config.clientName}`, {
          currentRoas: currentMetrics.roas,
          previousRoas: previousMetrics.roas,
          changePercent: roasChangePercent,
        });

        return this.warningResult(
          1,
          {
            title: 'Google Ads: ROAS daling',
            shortDescription: `ROAS ${roasChangePercent}% t.o.v. vorige week (${currentMetrics.roas.toFixed(2)} vs ${previousMetrics.roas.toFixed(2)})`,
            impact: `Je ROAS is gedaald van ${previousMetrics.roas.toFixed(2)} naar ${currentMetrics.roas.toFixed(2)}. ` +
              `Hoewel dit nog niet kritiek is, verdient deze trend aandacht om verdere daling te voorkomen.`,
            suggestedActions: [
              'Bekijk welke campagnes of productgroepen de daling veroorzaken',
              'Controleer of er recente wijzigingen zijn in biedingen of targeting',
              'Analyseer of de CTR of conversieratio is gedaald',
              'Monitor de trend de komende dagen nauwlettend',
              'Vergelijk met seizoenspatronen van vorig jaar',
            ],
            severity: 'high',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            roasChangePercent,
            lostRevenue: Math.max(0, lostRevenue),
          }
        );
      }

      // No significant ROAS decrease
      logger.debug(`No significant ROAS decrease for ${config.clientName}`, {
        currentRoas: currentMetrics.roas,
        previousRoas: previousMetrics.roas,
        changePercent: roasChangePercent,
      });

      return this.okResult({
        message: 'Geen significante ROAS daling',
        currentRoas: currentMetrics.roas,
        previousRoas: previousMetrics.roas,
        roasChangePercent,
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
    const aggregated = rows.reduce(
      (acc, row) => {
        acc.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
        acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        return acc;
      },
      { conversionsValue: 0, cost: 0 }
    );

    return {
      ...aggregated,
      roas: aggregated.cost > 0 ? aggregated.conversionsValue / aggregated.cost : 0,
    };
  }
}
