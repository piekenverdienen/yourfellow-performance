import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

/**
 * Check for duplicate keywords across ad groups
 * Causes self-competition and wasted budget
 */
export class KeywordConflictsCheck extends BaseGoogleAdsCheck {
  id = 'keyword_conflicts';
  name = 'Keyword Conflicten';
  description = 'Detecteert dezelfde keywords in meerdere ad groups (zelf-competitie)';

  private static GAQL_QUERY = `
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(KeywordConflictsCheck.GAQL_QUERY);

      // Group keywords by normalized text + match type
      const keywordGroups = new Map<string, Array<{ adGroupId: string; adGroupName: string; campaignName: string }>>();

      for (const row of response.results as any[]) {
        const keyword = row.adGroupCriterion?.keyword?.text?.toLowerCase().trim();
        const matchType = row.adGroupCriterion?.keyword?.matchType;
        if (!keyword) continue;

        const key = `${keyword}|${matchType}`;
        const locations = keywordGroups.get(key) || [];
        locations.push({
          adGroupId: row.adGroup?.id,
          adGroupName: row.adGroup?.name || 'Unknown',
          campaignName: row.campaign?.name || 'Unknown',
        });
        keywordGroups.set(key, locations);
      }

      // Find duplicates (keyword in more than 1 ad group)
      const conflicts = Array.from(keywordGroups.entries())
        .filter(([_, locations]) => locations.length > 1)
        .map(([key, locations]) => {
          const [keyword, matchType] = key.split('|');
          return {
            keyword,
            matchType,
            count: locations.length,
            locations: locations.slice(0, 5), // Limit to 5 locations
          };
        })
        .sort((a, b) => b.count - a.count);

      if (conflicts.length === 0) {
        return this.okResult({ message: 'Geen keyword conflicten gevonden' });
      }

      const count = conflicts.length;

      return this.errorResult(
        count,
        {
          title: 'Google Ads: keyword conflicten',
          shortDescription: `${count} keyword${count > 1 ? 's' : ''} in meerdere ad groups`,
          impact: 'Je concurreert met jezelf, dit verhoogt CPCs en verspilt budget',
          suggestedActions: [
            'Consolideer duplicate keywords naar één ad group',
            'Gebruik negatieve keywords om overlap te voorkomen',
            'Herstructureer campagnes voor betere organisatie',
          ],
          severity: count > 20 ? 'critical' : 'high',
          details: {
            conflictCount: count,
            worstOffender: conflicts[0]?.keyword,
          },
        },
        { conflicts: conflicts.slice(0, 15) }
      );
    } catch (error) {
      logger.error(`Error running ${this.id} check`, { error: (error as Error).message });
      throw error;
    }
  }
}
