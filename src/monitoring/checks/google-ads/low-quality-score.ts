import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for keywords with low Quality Score (≤4)
 * Low QS means higher CPCs and lower ad positions
 */
export class LowQualityScoreCheck extends BaseGoogleAdsCheck {
  id = 'low_quality_score';
  name = 'Lage Quality Score';
  description = 'Detecteert keywords met Quality Score 4 of lager';

  private static GAQL_QUERY = `
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.cost_micros
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.quality_info.quality_score <= 4
      AND segments.date DURING LAST_30_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(LowQualityScoreCheck.GAQL_QUERY);

      // Aggregate and deduplicate keywords
      const keywordMap = new Map<string, any>();

      for (const row of response.results as any[]) {
        const keyword = row.adGroupCriterion?.keyword?.text;
        if (!keyword) continue;

        const key = `${row.adGroup?.id}-${keyword}`;
        const existing = keywordMap.get(key);

        if (!existing) {
          keywordMap.set(key, {
            keyword,
            matchType: row.adGroupCriterion?.keyword?.matchType,
            qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore,
            adGroupName: row.adGroup?.name,
            campaignName: row.campaign?.name,
            impressions: parseInt(row.metrics?.impressions || '0', 10),
            cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
          });
        } else {
          existing.impressions += parseInt(row.metrics?.impressions || '0', 10);
          existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        }
      }

      // Filter for keywords with significant impressions
      const lowQsKeywords = Array.from(keywordMap.values())
        .filter(kw => kw.impressions > 100)
        .sort((a, b) => b.cost - a.cost);

      if (lowQsKeywords.length === 0) {
        return this.okResult({ message: 'Geen keywords met lage Quality Score' });
      }

      const count = lowQsKeywords.length;
      const totalCost = lowQsKeywords.reduce((sum, kw) => sum + kw.cost, 0);

      return this.errorResult(
        count,
        {
          title: 'Google Ads: lage Quality Scores',
          shortDescription: `${count} keyword${count > 1 ? 's' : ''} met QS ≤ 4`,
          impact: `Hogere CPCs en lagere posities. €${totalCost.toFixed(0)} besteed aan lage QS keywords`,
          suggestedActions: [
            'Verbeter landingspagina relevantie',
            'Optimaliseer advertentieteksten voor deze keywords',
            'Controleer verwachte CTR en voeg negatieve keywords toe',
            'Overweeg lage QS keywords te pauzeren',
          ],
          severity: count > 10 ? 'critical' : 'high',
          details: {
            keywordCount: count,
            totalCost: `€${totalCost.toFixed(2)}`,
          },
        },
        { keywords: lowQsKeywords.slice(0, 15) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
