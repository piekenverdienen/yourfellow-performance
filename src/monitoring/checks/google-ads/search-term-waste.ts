import { GoogleAdsClient } from '@/monitoring/google-ads';
import type { CheckResult, GoogleAdsMonitoringClientConfig } from '@/monitoring/google-ads';
import { Logger } from '@/monitoring/utils/logger';
import { BaseGoogleAdsCheck } from './base-check';

interface SearchTermRow {
  searchTermView: {
    searchTerm: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  adGroup: {
    id: string;
    name: string;
  };
  metrics: {
    clicks: string;
    costMicros: string;
    conversions: string;
    impressions: string;
  };
}

interface WastedSearchTerm {
  searchTerm: string;
  campaignName: string;
  adGroupName: string;
  clicks: number;
  cost: number;
  conversions: number;
  impressions: number;
}

/**
 * Check for search term waste (low-performing search queries)
 *
 * Why this matters to media buyers:
 * - Poor search terms waste budget on irrelevant queries
 * - Identifying waste enables negative keyword additions
 * - Regular hygiene prevents gradual efficiency decay
 *
 * Detection criteria:
 * - Search terms with:
 *   - At least €10 spend
 *   - At least 10 clicks
 *   - Zero conversions
 *
 * Output:
 * - Returns list of wasteful search terms
 * - Includes suggested negative keywords to add
 */
export class SearchTermWasteCheck extends BaseGoogleAdsCheck {
  id = 'search_term_waste';
  name = 'Zoekterm Verspilling';
  description = 'Detecteert zoektermen die kosten maar niet converteren, inclusief suggesties voor negatieve zoekwoorden';

  // Configurable thresholds
  private static MIN_SPEND = 10; // Minimum €10 spend to consider
  private static MIN_CLICKS = 10; // Minimum 10 clicks for statistical significance
  private static MAX_TERMS_TO_REPORT = 20; // Top N wasted terms to return
  private static WARNING_WASTE_AMOUNT = 100; // €100 total waste = warning
  private static CRITICAL_WASTE_AMOUNT = 500; // €500 total waste = critical

  /**
   * GAQL query for search term performance
   *
   * Note: search_term_view requires segment.date or a date range
   * We look at last 30 days to get meaningful data
   */
  private static GAQL_SEARCH_TERMS = `
    SELECT
      search_term_view.search_term,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.impressions
    FROM search_term_view
    WHERE
      segments.date DURING LAST_30_DAYS
      AND campaign.status = 'ENABLED'
      AND metrics.clicks >= 10
      AND metrics.cost_micros >= 10000000
      AND metrics.conversions = 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `;

  async run(
    client: GoogleAdsClient,
    config: GoogleAdsMonitoringClientConfig,
    logger: Logger
  ): Promise<CheckResult> {
    logger.debug(`Running ${this.id} check for ${config.clientName}`);

    try {
      // Query search terms with spend but no conversions
      const response = await client.query(SearchTermWasteCheck.GAQL_SEARCH_TERMS);
      const rows = response.results as unknown as SearchTermRow[];

      if (!rows || rows.length === 0) {
        logger.debug(`No wasted search terms found for ${config.clientName}`);
        return this.okResult({
          message: 'Geen zoektermen met significante verspilling gevonden',
          note: 'Alle zoektermen met >10 clicks en >€10 spend hebben conversies',
        });
      }

      // Process and aggregate the search terms
      const wastedTerms: WastedSearchTerm[] = rows
        .filter(row => row.searchTermView?.searchTerm)
        .map(row => ({
          searchTerm: row.searchTermView.searchTerm,
          campaignName: row.campaign?.name || 'Unknown',
          adGroupName: row.adGroup?.name || 'Unknown',
          clicks: parseInt(row.metrics?.clicks || '0', 10),
          cost: parseInt(row.metrics?.costMicros || '0', 10) / 1_000_000,
          conversions: parseFloat(row.metrics?.conversions || '0'),
          impressions: parseInt(row.metrics?.impressions || '0', 10),
        }))
        .filter(term =>
          term.cost >= SearchTermWasteCheck.MIN_SPEND &&
          term.clicks >= SearchTermWasteCheck.MIN_CLICKS &&
          term.conversions === 0
        )
        .slice(0, SearchTermWasteCheck.MAX_TERMS_TO_REPORT);

      if (wastedTerms.length === 0) {
        logger.debug(`No wasted search terms after filtering for ${config.clientName}`);
        return this.okResult({
          message: 'Geen zoektermen met significante verspilling na filtering',
        });
      }

      // Calculate total waste
      const totalWaste = wastedTerms.reduce((sum, term) => sum + term.cost, 0);
      const totalClicks = wastedTerms.reduce((sum, term) => sum + term.clicks, 0);

      // Generate suggested negative keywords
      const suggestedNegatives = this.generateNegativeKeywordSuggestions(wastedTerms);

      // Build response based on severity
      const topTerms = wastedTerms.slice(0, 5);
      const termsList = topTerms
        .map(t => `"${t.searchTerm}" (€${t.cost.toFixed(0)}, ${t.clicks} clicks)`)
        .join('\n  • ');

      // Determine severity based on total waste
      if (totalWaste >= SearchTermWasteCheck.CRITICAL_WASTE_AMOUNT) {
        logger.warn(`Critical search term waste for ${config.clientName}`, {
          totalWaste,
          termCount: wastedTerms.length,
        });

        return this.errorResult(
          wastedTerms.length,
          {
            title: 'Google Ads: significante zoekterm verspilling',
            shortDescription: `€${totalWaste.toFixed(0)} verspild aan ${wastedTerms.length} zoektermen zonder conversies (30 dagen)`,
            impact: `In de afgelopen 30 dagen is €${totalWaste.toFixed(0)} uitgegeven aan ${wastedTerms.length} zoektermen ` +
              `die samen ${totalClicks} clicks genereerden maar geen enkele conversie. ` +
              `Dit is direct budgetverlies dat voorkomen kan worden met negatieve zoekwoorden.\n\n` +
              `Top verspillers:\n  • ${termsList}`,
            suggestedActions: [
              `Voeg de volgende negatieve zoekwoorden toe: ${suggestedNegatives.slice(0, 5).join(', ')}`,
              'Bekijk je zoektermenrapport in Google Ads voor de volledige lijst',
              'Analyseer waarom deze zoektermen niet converteren (intentie mismatch?)',
              'Overweeg phrase match of exact match voor belangrijke zoekwoorden',
              'Stel een wekelijkse routine in om zoektermen te reviewen',
            ],
            severity: 'critical',
            details: {},
          },
          {
            wastedTerms: wastedTerms.map(t => ({
              searchTerm: t.searchTerm,
              cost: t.cost,
              clicks: t.clicks,
              campaignName: t.campaignName,
            })),
            totalWaste,
            totalClicks,
            suggestedNegatives,
            period: 'last_30_days',
          }
        );
      }

      if (totalWaste >= SearchTermWasteCheck.WARNING_WASTE_AMOUNT) {
        logger.info(`Search term waste warning for ${config.clientName}`, {
          totalWaste,
          termCount: wastedTerms.length,
        });

        return this.warningResult(
          wastedTerms.length,
          {
            title: 'Google Ads: zoekterm verspilling gedetecteerd',
            shortDescription: `€${totalWaste.toFixed(0)} verspild aan ${wastedTerms.length} zoektermen zonder conversies (30 dagen)`,
            impact: `Er is €${totalWaste.toFixed(0)} uitgegeven aan zoektermen die niet converteren. ` +
              `Dit is een goed moment om je zoektermenlijst op te schonen.\n\n` +
              `Voorbeelden:\n  • ${termsList}`,
            suggestedActions: [
              `Overweeg deze negatieve zoekwoorden toe te voegen: ${suggestedNegatives.slice(0, 3).join(', ')}`,
              'Review je zoektermenrapport wekelijks',
              'Analyseer of de zoekintentie past bij je aanbod',
            ],
            severity: 'high',
            details: {},
          },
          {
            wastedTerms: wastedTerms.map(t => ({
              searchTerm: t.searchTerm,
              cost: t.cost,
              clicks: t.clicks,
              campaignName: t.campaignName,
            })),
            totalWaste,
            totalClicks,
            suggestedNegatives,
            period: 'last_30_days',
          }
        );
      }

      // Low waste, just informational
      return this.okResult({
        message: 'Zoekterm verspilling onder drempel',
        totalWaste,
        termCount: wastedTerms.length,
        note: `€${totalWaste.toFixed(0)} verspilling in 30 dagen - onder de waarschuwingsdrempel van €${SearchTermWasteCheck.WARNING_WASTE_AMOUNT}`,
        suggestedNegatives: suggestedNegatives.slice(0, 5),
      });
    } catch (error) {
      // Handle case where search_term_view is not accessible
      // (e.g., PMax only accounts or permissions issues)
      const errorMessage = (error as Error).message;

      if (errorMessage.includes('PERMISSION_DENIED') ||
          errorMessage.includes('search_term_view')) {
        logger.debug(`Search term view not accessible for ${config.clientName}`, {
          error: errorMessage,
        });
        return this.okResult({
          message: 'Zoektermenrapport niet beschikbaar',
          note: 'Dit kan komen door accounttype (bijv. alleen PMax) of permissies',
        });
      }

      logger.error(`Error running ${this.id} check`, {
        error: errorMessage,
        clientName: config.clientName,
      });
      throw error;
    }
  }

  /**
   * Generate suggested negative keywords from wasted search terms
   *
   * Strategy:
   * - Extract common words from multiple wasted terms
   * - Identify irrelevant modifiers (e.g., "gratis", "goedkoop")
   * - Return as phrase match suggestions
   */
  private generateNegativeKeywordSuggestions(wastedTerms: WastedSearchTerm[]): string[] {
    const suggestions: string[] = [];

    // Common irrelevant modifiers in Dutch/English
    const irrelevantModifiers = [
      'gratis', 'free', 'goedkoop', 'cheap', 'kopen', 'download',
      'pdf', 'template', 'voorbeeld', 'example', 'diy', 'zelf',
      'vacature', 'job', 'salaris', 'salary', 'cursus', 'course',
      'wiki', 'wikipedia', 'review', 'ervaringen', 'forum',
    ];

    // Count word frequency across all wasted terms
    const wordCount: Record<string, number> = {};

    for (const term of wastedTerms) {
      const words = term.searchTerm.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 2) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      }
    }

    // Find words that appear in multiple wasted terms
    const frequentWords = Object.entries(wordCount)
      .filter(([word, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Check for irrelevant modifiers
    for (const modifier of irrelevantModifiers) {
      if (wordCount[modifier]) {
        suggestions.push(`"${modifier}"`);
      }
    }

    // Add high-spend individual terms as exact match negatives
    const highSpendTerms = wastedTerms
      .filter(t => t.cost >= 20)
      .slice(0, 5);

    for (const term of highSpendTerms) {
      const suggestion = `[${term.searchTerm}]`;
      if (!suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    }

    // Add frequent words not already covered
    for (const word of frequentWords) {
      if (!irrelevantModifiers.includes(word) && !suggestions.some(s => s.includes(word))) {
        suggestions.push(`"${word}"`);
      }
    }

    return suggestions.slice(0, 15);
  }
}
