import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface PerformanceMetrics {
  conversions: number;
  cost: number;
  cpa: number;
}

interface PerformanceRow {
  metrics: {
    conversions: string;
    costMicros: string;
  };
}

/**
 * Check for significant CPA (Cost Per Acquisition) increases
 *
 * Why this matters to media buyers:
 * - Rising CPA means you're paying more per conversion
 * - Could indicate increased competition, quality score drops, or audience fatigue
 * - Early detection allows budget reallocation before waste accumulates
 *
 * Thresholds:
 * - Warning: CPA increased by 20%+ vs previous period
 * - Critical: CPA increased by 40%+ vs previous period
 *
 * Minimum requirements:
 * - At least 5 conversions in current period (for statistical significance)
 * - At least 5 conversions in previous period (for valid comparison)
 */
export class CpaIncreaseCheck extends BaseGoogleAdsCheck {
  id = 'cpa_increase';
  name = 'CPA Stijging';
  description = 'Detecteert significante stijgingen in kosten per conversie ten opzichte van de baseline';

  // Configurable thresholds
  private static WARNING_THRESHOLD = 0.20; // 20% increase
  private static CRITICAL_THRESHOLD = 0.40; // 40% increase
  private static MIN_CONVERSIONS = 5; // Minimum conversions for valid comparison

  private static GAQL_CURRENT_PERIOD = `
    SELECT
      metrics.conversions,
      metrics.cost_micros
    FROM customer
    WHERE segments.date DURING LAST_7_DAYS
  `;

  private static GAQL_PREVIOUS_PERIOD = `
    SELECT
      metrics.conversions,
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
      const currentResponse = await client.query(CpaIncreaseCheck.GAQL_CURRENT_PERIOD);
      const currentMetrics = this.aggregateMetrics(currentResponse.results as unknown as PerformanceRow[]);

      // Get last 14 days metrics (to calculate previous 7 days)
      const fullResponse = await client.query(CpaIncreaseCheck.GAQL_PREVIOUS_PERIOD);
      const fullMetrics = this.aggregateMetrics(fullResponse.results as unknown as PerformanceRow[]);

      // Calculate previous period (last 14 days minus last 7 days)
      const previousMetrics: PerformanceMetrics = {
        conversions: fullMetrics.conversions - currentMetrics.conversions,
        cost: fullMetrics.cost - currentMetrics.cost,
        cpa: 0,
      };
      previousMetrics.cpa = previousMetrics.conversions > 0
        ? previousMetrics.cost / previousMetrics.conversions
        : 0;

      // Skip if insufficient conversions for valid comparison
      if (currentMetrics.conversions < CpaIncreaseCheck.MIN_CONVERSIONS) {
        logger.debug('Insufficient conversions in current period for CPA analysis', {
          currentConversions: currentMetrics.conversions,
          minRequired: CpaIncreaseCheck.MIN_CONVERSIONS,
        });
        return this.okResult({
          message: 'Te weinig conversies voor CPA-analyse',
          currentConversions: currentMetrics.conversions,
          minRequired: CpaIncreaseCheck.MIN_CONVERSIONS,
        });
      }

      if (previousMetrics.conversions < CpaIncreaseCheck.MIN_CONVERSIONS) {
        logger.debug('Insufficient conversions in previous period for CPA comparison', {
          previousConversions: previousMetrics.conversions,
          minRequired: CpaIncreaseCheck.MIN_CONVERSIONS,
        });
        return this.okResult({
          message: 'Te weinig conversies in vorige periode voor vergelijking',
          previousConversions: previousMetrics.conversions,
          minRequired: CpaIncreaseCheck.MIN_CONVERSIONS,
        });
      }

      // Calculate CPA change
      const cpaChange = (currentMetrics.cpa - previousMetrics.cpa) / previousMetrics.cpa;
      const cpaChangePercent = Math.round(cpaChange * 100);
      const cpaDifference = currentMetrics.cpa - previousMetrics.cpa;

      // Check for critical CPA increase
      if (cpaChange >= CpaIncreaseCheck.CRITICAL_THRESHOLD) {
        logger.warn(`Critical CPA increase for ${config.clientName}`, {
          currentCpa: currentMetrics.cpa,
          previousCpa: previousMetrics.cpa,
          changePercent: cpaChangePercent,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: kritieke CPA stijging',
            shortDescription: `CPA +${cpaChangePercent}% t.o.v. vorige week (€${currentMetrics.cpa.toFixed(2)} vs €${previousMetrics.cpa.toFixed(2)})`,
            impact: `Je betaalt nu €${cpaDifference.toFixed(2)} meer per conversie dan vorige week. ` +
              `Bij ${currentMetrics.conversions.toFixed(0)} conversies betekent dit €${(cpaDifference * currentMetrics.conversions).toFixed(0)} extra uitgaven. ` +
              `Dit vereist onmiddellijke actie om budgetverspilling te voorkomen.`,
            suggestedActions: [
              'Analyseer welke campagnes/ad groups de grootste CPA-stijging tonen',
              'Controleer of er kwaliteitsscores zijn gedaald (bekijk zoekwoorden met QS < 6)',
              'Bekijk of concurrentiedruk is toegenomen (impression share lost to rank)',
              'Evalueer of je doelgroep of targeting recent is gewijzigd',
              'Overweeg slecht presterende zoekwoorden te pauzeren of budgetten te herverdelen',
              'Controleer of landingspaginas correct werken en relevante content tonen',
            ],
            severity: 'critical',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            cpaChangePercent,
            cpaDifference,
          }
        );
      }

      // Check for warning CPA increase
      if (cpaChange >= CpaIncreaseCheck.WARNING_THRESHOLD) {
        logger.info(`CPA increase warning for ${config.clientName}`, {
          currentCpa: currentMetrics.cpa,
          previousCpa: previousMetrics.cpa,
          changePercent: cpaChangePercent,
        });

        return this.warningResult(
          1,
          {
            title: 'Google Ads: CPA stijging',
            shortDescription: `CPA +${cpaChangePercent}% t.o.v. vorige week (€${currentMetrics.cpa.toFixed(2)} vs €${previousMetrics.cpa.toFixed(2)})`,
            impact: `Je kosten per conversie zijn gestegen van €${previousMetrics.cpa.toFixed(2)} naar €${currentMetrics.cpa.toFixed(2)}. ` +
              `Hoewel dit nog geen kritieke situatie is, kan deze trend snel escaleren als niet wordt ingegrepen.`,
            suggestedActions: [
              'Identificeer welke campagnes of zoekwoorden de CPA omhoog drijven',
              'Controleer recente wijzigingen in campagne-instellingen of biedingen',
              'Analyseer of de CTR is gedaald (kan wijzen op advertentiemoeheid)',
              'Bekijk seizoenspatronen en vergelijk met vorig jaar',
              'Monitor de trend de komende dagen nauwlettend',
            ],
            severity: 'high',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            cpaChangePercent,
            cpaDifference,
          }
        );
      }

      // No significant CPA increase
      logger.debug(`No significant CPA increase for ${config.clientName}`, {
        currentCpa: currentMetrics.cpa,
        previousCpa: previousMetrics.cpa,
        changePercent: cpaChangePercent,
      });

      return this.okResult({
        message: 'Geen significante CPA stijging',
        currentCpa: currentMetrics.cpa,
        previousCpa: previousMetrics.cpa,
        cpaChangePercent,
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
        acc.conversions += parseFloat(row.metrics?.conversions || '0');
        acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        return acc;
      },
      { conversions: 0, cost: 0 }
    );

    return {
      ...aggregated,
      cpa: aggregated.conversions > 0 ? aggregated.cost / aggregated.conversions : 0,
    };
  }
}
