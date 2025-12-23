import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface KeywordQualityRow {
  adGroupCriterion: {
    criterionId: string;
    keyword: {
      text: string;
      matchType: string;
    };
    qualityInfo: {
      qualityScore: number;
      creativeLandingPageQuality: string;
      searchPredictedCtr: string;
      postClickQualityScore: string;
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
  };
}

/**
 * Check for keywords with low quality scores
 *
 * This check identifies keywords where:
 * - Quality Score is below 4 (out of 10)
 * - Keywords have meaningful impressions (>100 in last 30 days)
 * - Low QS indicates wasted spend and poor ad positions
 */
export class LowQualityScoreCheck extends BaseGoogleAdsCheck {
  id = 'low_quality_score';
  name = 'Lage Kwaliteitsscore';
  description = 'Detecteert keywords met lage kwaliteitsscore die budget verspillen';

  private static GAQL_QUERY = `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_landing_page_quality,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.quality_info.quality_score IS NOT NULL
      AND ad_group_criterion.quality_info.quality_score < 4
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

      if (response.results.length === 0) {
        logger.debug('No low quality score keywords found');
        return this.okResult({ message: 'Alle keywords hebben acceptabele kwaliteitsscores' });
      }

      const lowQsKeywords = this.processResults(response.results as KeywordQualityRow[]);

      // Filter to keywords with meaningful traffic (>100 impressions)
      const significantLowQs = lowQsKeywords.filter(kw => kw.impressions >= 100);

      if (significantLowQs.length === 0) {
        logger.debug('No significant low QS keywords (all have <100 impressions)');
        return this.okResult({
          message: 'Geen significante keywords met lage kwaliteitsscore',
          totalLowQs: lowQsKeywords.length,
          note: 'Er zijn keywords met lage QS maar zonder significante impressies',
        });
      }

      const count = significantLowQs.length;
      const totalWastedSpend = significantLowQs.reduce((sum, kw) => sum + kw.cost, 0);
      const avgQualityScore =
        significantLowQs.reduce((sum, kw) => sum + kw.qualityScore, 0) / count;

      logger.info(`Found ${count} keywords with low quality scores`, {
        clientName: config.clientName,
        avgQualityScore: avgQualityScore.toFixed(1),
        totalWastedSpend: totalWastedSpend.toFixed(2),
      });

      // Group by issue type for better insights
      const issueBreakdown = {
        landingPage: significantLowQs.filter(kw => kw.landingPageQuality === 'BELOW_AVERAGE').length,
        expectedCtr: significantLowQs.filter(kw => kw.expectedCtr === 'BELOW_AVERAGE').length,
        adRelevance: significantLowQs.filter(kw => kw.adRelevance === 'BELOW_AVERAGE').length,
      };

      return this.errorResult(
        count,
        {
          title: 'Google Ads: keywords met lage kwaliteitsscore',
          shortDescription: `${count} keyword${count > 1 ? 's' : ''} met QS < 4`,
          impact: `Hogere CPC's en lagere posities door lage kwaliteitsscores. €${totalWastedSpend.toFixed(2)} besteed aan lage QS keywords (30 dagen)`,
          suggestedActions: this.generateSuggestedActions(issueBreakdown),
          severity: count > 10 || totalWastedSpend > 500 ? 'high' : 'medium',
          details: {
            lowQsCount: count,
            avgQualityScore: Number(avgQualityScore.toFixed(1)),
            totalWastedSpend: Number(totalWastedSpend.toFixed(2)),
            issueBreakdown,
          },
        },
        {
          keywords: significantLowQs.slice(0, 15), // Top 15 by spend
          totalCount: count,
          issueBreakdown,
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
  private processResults(rows: KeywordQualityRow[]): Array<{
    keywordId: string;
    keyword: string;
    matchType: string;
    qualityScore: number;
    landingPageQuality: string;
    expectedCtr: string;
    adRelevance: string;
    adGroupName: string;
    campaignName: string;
    impressions: number;
    clicks: number;
    cost: number;
  }> {
    return rows
      .map(row => ({
        keywordId: row.adGroupCriterion?.criterionId || 'unknown',
        keyword: row.adGroupCriterion?.keyword?.text || 'Unknown Keyword',
        matchType: row.adGroupCriterion?.keyword?.matchType || 'UNKNOWN',
        qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore || 0,
        landingPageQuality: row.adGroupCriterion?.qualityInfo?.creativeLandingPageQuality || 'UNKNOWN',
        expectedCtr: row.adGroupCriterion?.qualityInfo?.searchPredictedCtr || 'UNKNOWN',
        adRelevance: row.adGroupCriterion?.qualityInfo?.postClickQualityScore || 'UNKNOWN',
        adGroupName: row.adGroup?.name || 'Unknown Ad Group',
        campaignName: row.campaign?.name || 'Unknown Campaign',
        impressions: parseInt(row.metrics?.impressions || '0', 10),
        clicks: parseInt(row.metrics?.clicks || '0', 10),
        cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
      }))
      .sort((a, b) => b.cost - a.cost); // Sort by cost descending
  }

  /**
   * Generate targeted suggestions based on issue breakdown
   */
  private generateSuggestedActions(issueBreakdown: {
    landingPage: number;
    expectedCtr: number;
    adRelevance: number;
  }): string[] {
    const actions: string[] = [];

    if (issueBreakdown.landingPage > 0) {
      actions.push(
        `Verbeter ${issueBreakdown.landingPage} landingspagina's - laadsnelheid, relevantie, mobiele ervaring`
      );
    }

    if (issueBreakdown.expectedCtr > 0) {
      actions.push(
        `Optimaliseer advertentieteksten voor ${issueBreakdown.expectedCtr} keywords met lage verwachte CTR`
      );
    }

    if (issueBreakdown.adRelevance > 0) {
      actions.push(
        `Verbeter advertentie-relevantie voor ${issueBreakdown.adRelevance} keywords - match zoekintentie beter`
      );
    }

    actions.push(
      'Overweeg slecht presterende keywords te pauzeren',
      'Maak meer specifieke advertentiegroepen voor betere relevantie',
      'Test nieuwe advertentievarianten met sterkere CTA'
    );

    return actions;
  }
}
