import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface PerformanceMetrics {
  cost: number;
  conversions: number;
  conversionsValue: number;
  clicks: number;
  impressions: number;
}

interface PerformanceRow {
  metrics: {
    costMicros: string;
    conversions: string;
    conversionsValue: string;
    clicks: string;
    impressions: string;
  };
}

/**
 * Check for significant spend increases without proportional conversions/value
 *
 * Why this matters to media buyers:
 * - Spending more without getting proportional results = budget waste
 * - Could indicate: wasted budget scaling, competitor activity, or quality issues
 * - Early detection prevents significant budget losses
 *
 * Triggers:
 * - Spend increased 30%+ while conversions stayed flat or declined
 * - Spend increased 50%+ while value/revenue didn't increase proportionally
 *
 * Minimum requirements:
 * - At least €100 spend in both periods for meaningful comparison
 */
export class SpendWithoutValueCheck extends BaseGoogleAdsCheck {
  id = 'spend_without_value';
  name = 'Uitgaven Zonder Resultaat';
  description = 'Detecteert wanneer uitgaven stijgen zonder evenredige toename in conversies of waarde';

  // Configurable thresholds
  private static SPEND_INCREASE_WARNING = 0.30; // 30% spend increase
  private static SPEND_INCREASE_CRITICAL = 0.50; // 50% spend increase
  private static VALUE_GROWTH_TOLERANCE = 0.10; // Results should grow within 10% of spend growth
  private static MIN_SPEND = 100; // Minimum €100 spend in both periods

  private static GAQL_CURRENT_PERIOD = `
    SELECT
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.clicks,
      metrics.impressions
    FROM customer
    WHERE segments.date DURING LAST_7_DAYS
  `;

  private static GAQL_PREVIOUS_PERIOD = `
    SELECT
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
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
      const currentResponse = await client.query(SpendWithoutValueCheck.GAQL_CURRENT_PERIOD);
      const currentMetrics = this.aggregateMetrics(currentResponse.results as unknown as PerformanceRow[]);

      // Get last 14 days metrics (to calculate previous 7 days)
      const fullResponse = await client.query(SpendWithoutValueCheck.GAQL_PREVIOUS_PERIOD);
      const fullMetrics = this.aggregateMetrics(fullResponse.results as unknown as PerformanceRow[]);

      // Calculate previous period (last 14 days minus last 7 days)
      const previousMetrics: PerformanceMetrics = {
        cost: fullMetrics.cost - currentMetrics.cost,
        conversions: fullMetrics.conversions - currentMetrics.conversions,
        conversionsValue: fullMetrics.conversionsValue - currentMetrics.conversionsValue,
        clicks: fullMetrics.clicks - currentMetrics.clicks,
        impressions: fullMetrics.impressions - currentMetrics.impressions,
      };

      // Skip if insufficient spend for valid comparison
      if (previousMetrics.cost < SpendWithoutValueCheck.MIN_SPEND) {
        logger.debug('Insufficient spend in previous period for comparison', {
          previousSpend: previousMetrics.cost,
          minRequired: SpendWithoutValueCheck.MIN_SPEND,
        });
        return this.okResult({
          message: 'Te weinig uitgaven in vorige periode voor vergelijking',
          previousSpend: previousMetrics.cost,
          minRequired: SpendWithoutValueCheck.MIN_SPEND,
        });
      }

      if (currentMetrics.cost < SpendWithoutValueCheck.MIN_SPEND) {
        logger.debug('Insufficient spend in current period', {
          currentSpend: currentMetrics.cost,
          minRequired: SpendWithoutValueCheck.MIN_SPEND,
        });
        return this.okResult({
          message: 'Te weinig uitgaven in huidige periode voor analyse',
          currentSpend: currentMetrics.cost,
          minRequired: SpendWithoutValueCheck.MIN_SPEND,
        });
      }

      // Calculate changes
      const spendChange = (currentMetrics.cost - previousMetrics.cost) / previousMetrics.cost;
      const spendChangePercent = Math.round(spendChange * 100);

      const conversionChange = previousMetrics.conversions > 0
        ? (currentMetrics.conversions - previousMetrics.conversions) / previousMetrics.conversions
        : (currentMetrics.conversions > 0 ? 1 : 0);
      const conversionChangePercent = Math.round(conversionChange * 100);

      const valueChange = previousMetrics.conversionsValue > 0
        ? (currentMetrics.conversionsValue - previousMetrics.conversionsValue) / previousMetrics.conversionsValue
        : (currentMetrics.conversionsValue > 0 ? 1 : 0);
      const valueChangePercent = Math.round(valueChange * 100);

      // Calculate efficiency
      const extraSpend = currentMetrics.cost - previousMetrics.cost;
      const extraConversions = currentMetrics.conversions - previousMetrics.conversions;
      const extraValue = currentMetrics.conversionsValue - previousMetrics.conversionsValue;

      // Check if spend is increasing significantly
      if (spendChange < SpendWithoutValueCheck.SPEND_INCREASE_WARNING) {
        // Spend didn't increase significantly, no issue
        return this.okResult({
          message: 'Geen significante uitgavenstijging',
          spendChangePercent,
          conversionChangePercent,
          valueChangePercent,
        });
      }

      // Determine if value growth is proportional to spend growth
      const expectedGrowth = spendChange - SpendWithoutValueCheck.VALUE_GROWTH_TOLERANCE;

      // Use the best performing metric (conversions or value) for comparison
      const hasConversionValueTracking = previousMetrics.conversionsValue > 0 || currentMetrics.conversionsValue > 0;
      const bestResultGrowth = hasConversionValueTracking
        ? Math.max(conversionChange, valueChange)
        : conversionChange;
      const bestResultGrowthPercent = Math.round(bestResultGrowth * 100);

      // Check for disproportionate growth
      const growthGap = spendChange - bestResultGrowth;
      const isDisproportionate = bestResultGrowth < expectedGrowth;

      if (!isDisproportionate) {
        // Results are growing proportionally with spend
        return this.okResult({
          message: 'Uitgavenstijging met evenredige resultaatgroei',
          spendChangePercent,
          conversionChangePercent,
          valueChangePercent,
        });
      }

      // Calculate wasted spend (extra spend that didn't convert proportionally)
      const expectedExtraConversions = previousMetrics.conversions * spendChange;
      const conversionShortfall = Math.max(0, expectedExtraConversions - extraConversions);
      const wastedSpendEstimate = previousMetrics.conversions > 0
        ? (conversionShortfall / previousMetrics.conversions) * previousMetrics.cost
        : extraSpend * (1 - (bestResultGrowth / spendChange));

      // Critical: 50%+ spend increase with flat/declining results
      if (spendChange >= SpendWithoutValueCheck.SPEND_INCREASE_CRITICAL && bestResultGrowth <= 0.10) {
        logger.warn(`Critical spend increase without value for ${config.clientName}`, {
          spendChangePercent,
          bestResultGrowthPercent,
        });

        return this.errorResult(
          1,
          {
            title: 'Google Ads: ernstige budgetverspilling',
            shortDescription: `Uitgaven +${spendChangePercent}%, resultaat slechts +${bestResultGrowthPercent}%`,
            impact: `Je uitgaven zijn met €${extraSpend.toFixed(0)} (+${spendChangePercent}%) gestegen, ` +
              `maar je resultaten groeiden slechts ${bestResultGrowthPercent}%. ` +
              `Geschatte verspilling: €${wastedSpendEstimate.toFixed(0)}. ` +
              `Dit wijst op ernstige inefficiëntie die direct moet worden aangepakt.`,
            suggestedActions: [
              'STOP met schalen totdat de oorzaak is gevonden',
              'Analyseer welke campagnes/ad groups de extra uitgaven hebben en hun prestaties',
              'Controleer of er automatische biedverhogingen hebben plaatsgevonden',
              'Bekijk of er nieuwe zoekwoorden of doelgroepen zijn toegevoegd',
              'Evalueer of de kwaliteit van verkeer is gedaald (check bounce rates)',
              'Controleer of er technische problemen zijn met conversietracking',
              'Vergelijk de incrementele CPA van nieuwe uitgaven vs baseline',
            ],
            severity: 'critical',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            spendChangePercent,
            conversionChangePercent,
            valueChangePercent,
            wastedSpendEstimate,
            growthGap: Math.round(growthGap * 100),
          }
        );
      }

      // Warning: 30%+ spend increase without proportional results
      if (spendChange >= SpendWithoutValueCheck.SPEND_INCREASE_WARNING && isDisproportionate) {
        logger.info(`Spend increase without proportional value for ${config.clientName}`, {
          spendChangePercent,
          bestResultGrowthPercent,
        });

        return this.warningResult(
          1,
          {
            title: 'Google Ads: uitgavenstijging zonder evenredig resultaat',
            shortDescription: `Uitgaven +${spendChangePercent}%, resultaat +${bestResultGrowthPercent}%`,
            impact: `Je uitgaven zijn met ${spendChangePercent}% gestegen, ` +
              `maar je resultaten groeiden slechts ${bestResultGrowthPercent}%. ` +
              `De efficiëntie van je extra uitgaven is lager dan je baseline performance. ` +
              `Geschatte inefficiënte uitgaven: €${wastedSpendEstimate.toFixed(0)}.`,
            suggestedActions: [
              'Identificeer welke campagnes of targeting de extra uitgaven veroorzaken',
              'Vergelijk de marginale CPA/ROAS van nieuwe uitgaven met je gemiddelde',
              'Controleer of automatische biedstrategieën te agressief schalen',
              'Evalueer of nieuwe audiences of zoekwoorden ondermaats presteren',
              'Overweeg een cap te zetten op uitgavenstijgingen',
            ],
            severity: 'high',
            details: {},
          },
          {
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics,
            spendChangePercent,
            conversionChangePercent,
            valueChangePercent,
            wastedSpendEstimate,
            growthGap: Math.round(growthGap * 100),
          }
        );
      }

      // No significant issue
      return this.okResult({
        message: 'Uitgavenstijging binnen acceptabele verhouding tot resultaten',
        spendChangePercent,
        conversionChangePercent,
        valueChangePercent,
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
        acc.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        acc.conversions += parseFloat(row.metrics?.conversions || '0');
        acc.conversionsValue += parseFloat(row.metrics?.conversionsValue || '0');
        acc.clicks += parseInt(row.metrics?.clicks || '0', 10);
        acc.impressions += parseInt(row.metrics?.impressions || '0', 10);
        return acc;
      },
      { cost: 0, conversions: 0, conversionsValue: 0, clicks: 0, impressions: 0 }
    );
  }
}
