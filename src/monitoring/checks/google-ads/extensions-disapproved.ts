import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface ExtensionRow {
  extensionFeedItem?: {
    id: string;
    extensionType: string;
    status: string;
  };
  asset?: {
    id: string;
    name: string;
    type: string;
    policySummary?: {
      approvalStatus: string;
      reviewStatus: string;
      policyTopicEntries?: Array<{
        topic: string;
        type: string;
      }>;
    };
  };
  campaign?: {
    id: string;
    name: string;
  };
}

/**
 * Check for disapproved ad extensions/assets
 *
 * This check identifies:
 * - Sitelinks that are disapproved
 * - Callout extensions that are disapproved
 * - Structured snippets that are disapproved
 * - Other assets with policy violations
 */
export class ExtensionsDisapprovedCheck extends BaseGoogleAdsCheck {
  id = 'extensions_disapproved';
  name = 'Extensies Afgekeurd';
  description = 'Detecteert afgekeurde advertentie-extensies en assets';

  // Query for campaign-level asset status
  private static ASSETS_QUERY = `
    SELECT
      asset.id,
      asset.name,
      asset.type,
      asset.policy_summary.approval_status,
      asset.policy_summary.review_status,
      asset.policy_summary.policy_topic_entries
    FROM asset
    WHERE asset.policy_summary.approval_status IN ('DISAPPROVED', 'AREA_OF_INTEREST_ONLY', 'UNKNOWN')
      AND asset.type IN ('SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'CALL', 'PROMOTION', 'PRICE', 'IMAGE')
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      const response = await client.query(ExtensionsDisapprovedCheck.ASSETS_QUERY);

      if (response.results.length === 0) {
        logger.debug('No disapproved extensions found');
        return this.okResult({ message: 'Alle extensies en assets zijn goedgekeurd' });
      }

      const disapprovedExtensions = this.processResults(response.results as unknown as ExtensionRow[]);

      if (disapprovedExtensions.length === 0) {
        return this.okResult({ message: 'Alle extensies en assets zijn goedgekeurd' });
      }

      const count = disapprovedExtensions.length;

      // Group by type
      const byType = disapprovedExtensions.reduce((acc, ext) => {
        acc[ext.type] = (acc[ext.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Collect unique policy topics
      const allPolicyTopics = new Set<string>();
      for (const ext of disapprovedExtensions) {
        for (const topic of ext.policyTopics) {
          allPolicyTopics.add(topic);
        }
      }

      logger.info(`Found ${count} disapproved extensions`, {
        clientName: config.clientName,
        byType,
        policyTopics: Array.from(allPolicyTopics),
      });

      // Determine severity based on type
      const hasSitelinks = (byType['SITELINK'] || 0) > 0;
      const severity = hasSitelinks && count > 2 ? 'high' : 'medium';

      return this.errorResult(
        count,
        {
          title: 'Google Ads: extensies afgekeurd',
          shortDescription: `${count} extensie${count > 1 ? 's' : ''} afgekeurd`,
          impact: hasSitelinks
            ? 'Afgekeurde sitelinks verminderen je advertentieruimte en CTR significant'
            : 'Afgekeurde extensies verminderen advertentie-effectiviteit',
          suggestedActions: [
            'Bekijk de afgekeurde extensies in Google Ads',
            'Controleer welke policy topics zijn geschonden',
            'Pas de tekst of URL aan volgens de richtlijnen',
            'Dien de extensies opnieuw in ter review',
            'Vervang afgekeurde extensies door nieuwe varianten',
          ],
          severity,
          details: {
            disapprovedCount: count,
            byType,
            policyTopics: Array.from(allPolicyTopics),
          },
        },
        {
          extensions: disapprovedExtensions.slice(0, 15),
          totalCount: count,
          byType,
          policyTopics: Array.from(allPolicyTopics),
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
   * Process query results into structured extension data
   */
  private processResults(rows: ExtensionRow[]): Array<{
    assetId: string;
    name: string;
    type: string;
    approvalStatus: string;
    policyTopics: string[];
  }> {
    return rows
      .filter(row => row.asset?.policySummary?.approvalStatus !== 'APPROVED')
      .map(row => {
        const policyTopics = (row.asset?.policySummary?.policyTopicEntries || [])
          .map(entry => entry.topic)
          .filter(Boolean);

        return {
          assetId: row.asset?.id || 'unknown',
          name: row.asset?.name || 'Unnamed Extension',
          type: row.asset?.type || 'UNKNOWN',
          approvalStatus: row.asset?.policySummary?.approvalStatus || 'UNKNOWN',
          policyTopics,
        };
      });
  }
}
