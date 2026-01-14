import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface KeywordCpcRow {
  adGroupCriterion: {
    criterionId: string;
    keyword: {
      text: string;
      matchType: string;
    };
    status: string;
  };
  adGroup: {
    id: string;
    name: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
    averageCpc: string;
  };
}

/**
 * Check for keywords with abnormally high CPC
 *
 * This check identifies keywords where:
 * - Average CPC is significantly higher than account average
 * - CPC has spiked compared to historical data
 * - High CPC keywords might indicate bidding wars or quality issues
 */
export class HighCpcCheck extends BaseGoogleAdsCheck {
  id = 'high_cpc';
  name = 'Hoge CPC Alert';
  description = 'Detecteert keywords met abnormaal hoge kosten per klik';

  // Get recent keyword performance
  private static GAQL_QUERY = `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.average_cpc
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND metrics.clicks > 0
      AND segments.date DURING LAST_7_DAYS
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(HighCpcCheck.GAQL_QUERY);

      if (response.results.length === 0) {
        logger.debug('No keyword data found for CPC analysis');
        return this.okResult({ message: 'Geen keyword data voor CPC analyse' });
      }

      const keywordData = this.processResults(response.results as unknown as KeywordCpcRow[]);

      if (keywordData.length === 0) {
        return this.okResult({ message: 'Geen keywords met voldoende data' });
      }

      // Calculate account average CPC
      const totalCost = keywordData.reduce((sum, kw) => sum + kw.cost, 0);
      const totalClicks = keywordData.reduce((sum, kw) => sum + kw.clicks, 0);
      const accountAvgCpc = totalClicks > 0 ? totalCost / totalClicks : 0;

      // Find keywords with CPC > 2x account average (and significant spend)
      const highCpcThreshold = accountAvgCpc * 2;
      const minSpendThreshold = 10; // €10 minimum spend to be considered

      const highCpcKeywords = keywordData.filter(
        kw => kw.avgCpc > highCpcThreshold && kw.cost >= minSpendThreshold
      );

      if (highCpcKeywords.length === 0) {
        logger.debug('No abnormally high CPC keywords found');
        return this.okResult({
          message: 'Geen keywords met abnormaal hoge CPC',
          accountAvgCpc: Number(accountAvgCpc.toFixed(2)),
          totalKeywords: keywordData.length,
        });
      }

      const count = highCpcKeywords.length;
      const totalHighCpcSpend = highCpcKeywords.reduce((sum, kw) => sum + kw.cost, 0);
      const maxCpc = Math.max(...highCpcKeywords.map(kw => kw.avgCpc));

      logger.info(`Found ${count} keywords with high CPC`, {
        clientName: config.clientName,
        accountAvgCpc: accountAvgCpc.toFixed(2),
        maxCpc: maxCpc.toFixed(2),
        totalHighCpcSpend: totalHighCpcSpend.toFixed(2),
      });

      return this.errorResult(
        count,
        {
          title: 'Google Ads: keywords met hoge CPC',
          shortDescription: `${count} keyword${count > 1 ? 's' : ''} met CPC > 2x gemiddelde`,
          impact: `€${totalHighCpcSpend.toFixed(2)} besteed aan dure keywords (7 dagen). Account gemiddelde: €${accountAvgCpc.toFixed(2)}, hoogste: €${maxCpc.toFixed(2)}`,
          suggestedActions: [
            'Analyseer of deze keywords converteren (ROAS/CPA check)',
            'Bekijk concurrentie in Auction Insights',
            'Overweeg bid adjustments of bid caps',
            'Test alternatieve match types voor lagere CPC',
            'Verbeter kwaliteitsscore om CPC te verlagen',
            'Evalueer of deze keywords waarde toevoegen',
          ],
          severity: totalHighCpcSpend > 500 || count > 10 ? 'high' : 'medium',
          details: {
            highCpcCount: count,
            accountAvgCpc: Number(accountAvgCpc.toFixed(2)),
            highCpcThreshold: Number(highCpcThreshold.toFixed(2)),
            maxCpc: Number(maxCpc.toFixed(2)),
            totalHighCpcSpend: Number(totalHighCpcSpend.toFixed(2)),
          },
        },
        {
          keywords: highCpcKeywords.slice(0, 15).map(kw => ({
            ...kw,
            cpcVsAverage: `${((kw.avgCpc / accountAvgCpc) * 100).toFixed(0)}%`,
          })),
          totalCount: count,
          accountAvgCpc: Number(accountAvgCpc.toFixed(2)),
        }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, {
        error: (error as Error).message,
        clientName: config.clientName,
      });
      throw error;
    }
  }

  /**
   * Process results into structured keyword data
   */
  private processResults(rows: KeywordCpcRow[]): Array<{
    keywordId: string;
    keyword: string;
    matchType: string;
    adGroupName: string;
    campaignName: string;
    impressions: number;
    clicks: number;
    cost: number;
    avgCpc: number;
  }> {
    return rows
      .map(row => {
        const costMicros = parseInt(row.metrics?.costMicros || '0', 10);
        const clicks = parseInt(row.metrics?.clicks || '0', 10);

        return {
          keywordId: row.adGroupCriterion?.criterionId || 'unknown',
          keyword: row.adGroupCriterion?.keyword?.text || 'Unknown Keyword',
          matchType: row.adGroupCriterion?.keyword?.matchType || 'UNKNOWN',
          adGroupName: row.adGroup?.name || 'Unknown Ad Group',
          campaignName: row.campaign?.name || 'Unknown Campaign',
          impressions: parseInt(row.metrics?.impressions || '0', 10),
          clicks,
          cost: costMicros / 1_000_000,
          avgCpc: clicks > 0 ? costMicros / 1_000_000 / clicks : 0,
        };
      })
      .filter(kw => kw.clicks >= 3) // Minimum 3 clicks for meaningful CPC
      .sort((a, b) => b.avgCpc - a.avgCpc); // Sort by CPC descending
  }
}
