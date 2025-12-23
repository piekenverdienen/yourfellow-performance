import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for wasted spend on irrelevant search terms
 * Identifies search terms with spend but no conversions
 */
export class SearchTermWasteCheck extends BaseGoogleAdsCheck {
  id = 'search_term_waste';
  name = 'Verspilling Zoektermen';
  description = 'Detecteert zoektermen met hoge spend maar geen conversies';

  private static GAQL_QUERY = `
    SELECT
      search_term_view.search_term,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status = 'ENABLED'
      AND metrics.cost_micros > 0
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(SearchTermWasteCheck.GAQL_QUERY);

      // Aggregate search terms
      const termMap = new Map<string, { cost: number; conversions: number; clicks: number; campaigns: Set<string> }>();

      for (const row of response.results as any[]) {
        const term = row.searchTermView?.searchTerm;
        if (!term) continue;

        const existing = termMap.get(term) || { cost: 0, conversions: 0, clicks: 0, campaigns: new Set() };
        existing.cost += parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000;
        existing.conversions += parseFloat(row.metrics?.conversions || '0');
        existing.clicks += parseInt(row.metrics?.clicks || '0', 10);
        existing.campaigns.add(row.campaign?.name || 'Unknown');
        termMap.set(term, existing);
      }

      // Find wasteful terms: high spend (>€20), decent clicks (>10), zero conversions
      const wastefulTerms = Array.from(termMap.entries())
        .filter(([_, data]) => data.cost > 20 && data.clicks > 10 && data.conversions === 0)
        .map(([term, data]) => ({
          searchTerm: term,
          cost: data.cost,
          clicks: data.clicks,
          campaigns: Array.from(data.campaigns).slice(0, 3),
        }))
        .sort((a, b) => b.cost - a.cost);

      if (wastefulTerms.length === 0) {
        return this.okResult({ message: 'Geen verspilling aan zoektermen gedetecteerd' });
      }

      const count = wastefulTerms.length;
      const totalWaste = wastefulTerms.reduce((sum, t) => sum + t.cost, 0);

      return this.errorResult(
        count,
        {
          title: 'Google Ads: verspilling aan zoektermen',
          shortDescription: `€${totalWaste.toFixed(0)} besteed aan ${count} zoekterm${count > 1 ? 'en' : ''} zonder conversies`,
          impact: 'Budget gaat naar irrelevante zoektermen',
          suggestedActions: [
            'Voeg deze zoektermen toe als negatieve keywords',
            'Bekijk of match types aangepast moeten worden',
            'Analyseer of landingspaginas relevant zijn',
          ],
          severity: totalWaste > 200 ? 'critical' : 'high',
          details: {
            termCount: count,
            totalWaste: `€${totalWaste.toFixed(2)}`,
            period: 'Laatste 30 dagen',
          },
        },
        { terms: wastefulTerms.slice(0, 20) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
