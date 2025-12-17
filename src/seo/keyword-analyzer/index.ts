/**
 * Keyword Gap & Opportunity Analyzer
 *
 * Analyzes Search Console data against page content to identify:
 * - Keyword gaps: High impressions but keyword missing from content
 * - Ranking opportunities: Position 8-20, can be improved
 * - CTR mismatches: Low CTR despite good position
 * - Intent mismatches: Query intent doesn't match content
 * - Quick wins: Position 4-10 with good impressions
 */

import type {
  PageContent,
  SearchConsoleQuery,
  KeywordOpportunity,
  KeywordAnalysisResult,
  OpportunityType,
} from '../types'

export interface AnalyzerThresholds {
  minImpressions: number       // Minimum impressions to consider (default: 50)
  minPosition: number          // Min position for opportunities (default: 4)
  maxPosition: number          // Max position to consider (default: 50)
  lowCtrThreshold: number      // CTR below this is "low" (default: 0.02 = 2%)
  highImpressionsThreshold: number  // High impressions threshold (default: 100)
  quickWinMinPosition: number  // Min position for quick wins (default: 4)
  quickWinMaxPosition: number  // Max position for quick wins (default: 10)
}

const DEFAULT_THRESHOLDS: AnalyzerThresholds = {
  minImpressions: 50,
  minPosition: 4,
  maxPosition: 50,
  lowCtrThreshold: 0.02,
  highImpressionsThreshold: 100,
  quickWinMinPosition: 4,
  quickWinMaxPosition: 10,
}

/**
 * Analyze keywords for opportunities
 */
export function analyzeKeywords(
  pageContent: PageContent,
  queries: SearchConsoleQuery[],
  thresholds: Partial<AnalyzerThresholds> = {}
): KeywordAnalysisResult {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }

  // Build searchable content index (lowercased)
  const contentIndex = buildContentIndex(pageContent)

  // Filter queries by thresholds
  const relevantQueries = queries.filter(
    (q) =>
      q.impressions >= t.minImpressions &&
      q.position >= t.minPosition &&
      q.position <= t.maxPosition
  )

  const opportunities: KeywordOpportunity[] = []

  for (const query of relevantQueries) {
    const opportunityTypes = detectOpportunityTypes(query, contentIndex, t)

    for (const type of opportunityTypes) {
      const opportunity = createOpportunity(query, type, contentIndex, t)
      opportunities.push(opportunity)
    }
  }

  // Sort by priority and impressions
  opportunities.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.metrics.impressions - a.metrics.impressions
  })

  // Calculate summary
  const summary = {
    keywordGaps: opportunities.filter((o) => o.type === 'keyword_gap').length,
    rankingOpportunities: opportunities.filter((o) => o.type === 'ranking_opportunity').length,
    ctrIssues: opportunities.filter((o) => o.type === 'ctr_mismatch').length,
    intentMismatches: opportunities.filter((o) => o.type === 'intent_mismatch').length,
    quickWins: opportunities.filter((o) => o.type === 'quick_win').length,
  }

  return {
    pageUrl: pageContent.url,
    totalOpportunities: opportunities.length,
    opportunities,
    summary,
    analyzedAt: new Date(),
  }
}

/**
 * Build searchable content index from page content
 */
function buildContentIndex(content: PageContent): ContentIndex {
  const allText = [
    content.title,
    content.metaDescription,
    ...content.h1,
    ...content.h2,
    ...content.h3,
    content.mainText,
  ]
    .join(' ')
    .toLowerCase()

  const titleAndMeta = [content.title, content.metaDescription].join(' ').toLowerCase()

  const headings = [...content.h1, ...content.h2, ...content.h3].join(' ').toLowerCase()

  return {
    allText,
    titleAndMeta,
    headings,
    title: content.title.toLowerCase(),
    h1: content.h1.map((h) => h.toLowerCase()),
    h2: content.h2.map((h) => h.toLowerCase()),
    mainText: content.mainText.toLowerCase(),
    wordCount: content.wordCount,
  }
}

interface ContentIndex {
  allText: string
  titleAndMeta: string
  headings: string
  title: string
  h1: string[]
  h2: string[]
  mainText: string
  wordCount: number
}

/**
 * Detect opportunity types for a query
 */
function detectOpportunityTypes(
  query: SearchConsoleQuery,
  content: ContentIndex,
  thresholds: AnalyzerThresholds
): OpportunityType[] {
  const types: OpportunityType[] = []
  const queryLower = query.query.toLowerCase()
  const queryWords = queryLower.split(/\s+/)

  // Check if keyword is present in content
  const inTitle = content.title.includes(queryLower)
  const inHeadings = content.headings.includes(queryLower)
  const inAllText = content.allText.includes(queryLower)

  // Check partial matches (individual words)
  const wordsInContent = queryWords.filter((word) => word.length > 3 && content.allText.includes(word))
  const partialMatch = wordsInContent.length >= queryWords.length * 0.5

  // 1. Keyword Gap: High impressions but keyword missing
  if (query.impressions >= thresholds.highImpressionsThreshold && !inAllText && !partialMatch) {
    types.push('keyword_gap')
  }

  // 2. Quick Win: Position 4-10 with good impressions
  if (
    query.position >= thresholds.quickWinMinPosition &&
    query.position <= thresholds.quickWinMaxPosition &&
    query.impressions >= thresholds.minImpressions
  ) {
    types.push('quick_win')
  }

  // 3. Ranking Opportunity: Position 8-20
  if (query.position >= 8 && query.position <= 20 && query.impressions >= thresholds.minImpressions) {
    types.push('ranking_opportunity')
  }

  // 4. CTR Mismatch: Low CTR despite decent position
  if (
    query.ctr < thresholds.lowCtrThreshold &&
    query.position <= 10 &&
    query.impressions >= thresholds.minImpressions
  ) {
    types.push('ctr_mismatch')
  }

  // 5. Intent Mismatch: Query suggests different intent than content provides
  const intentMismatch = detectIntentMismatch(queryLower, content)
  if (intentMismatch) {
    types.push('intent_mismatch')
  }

  return types
}

/**
 * Detect potential intent mismatch
 */
function detectIntentMismatch(query: string, content: ContentIndex): boolean {
  // Informational queries often start with question words
  const informationalPatterns = /^(wat|hoe|waarom|wanneer|wie|welke|what|how|why|when|who|which)/i
  const isInformational = informationalPatterns.test(query)

  // Check if content seems to match intent
  if (isInformational) {
    // Look for FAQ-style content or explanatory text
    const hasFaqContent = content.allText.includes('vraag') || content.allText.includes('antwoord')
    const hasExplanatoryHeaders =
      content.headings.includes('wat is') ||
      content.headings.includes('hoe') ||
      content.headings.includes('what is') ||
      content.headings.includes('how to')

    // If query is informational but content doesn't seem explanatory
    if (!hasFaqContent && !hasExplanatoryHeaders && content.wordCount < 500) {
      return true
    }
  }

  // Transactional queries
  const transactionalPatterns = /(kopen|bestellen|prijs|kosten|buy|order|price|cost|shop)/i
  const isTransactional = transactionalPatterns.test(query)

  if (isTransactional) {
    // Check if content has transactional elements
    const hasTransactionalContent =
      content.allText.includes('prijs') ||
      content.allText.includes('kopen') ||
      content.allText.includes('bestellen') ||
      content.allText.includes('price') ||
      content.allText.includes('buy')

    if (!hasTransactionalContent) {
      return true
    }
  }

  return false
}

/**
 * Create opportunity object with reasoning
 */
function createOpportunity(
  query: SearchConsoleQuery,
  type: OpportunityType,
  content: ContentIndex,
  thresholds: AnalyzerThresholds
): KeywordOpportunity {
  const queryLower = query.query.toLowerCase()

  // Determine priority
  let priority: 'high' | 'medium' | 'low' = 'medium'

  if (type === 'quick_win' && query.impressions >= thresholds.highImpressionsThreshold) {
    priority = 'high'
  } else if (type === 'keyword_gap' && query.impressions >= thresholds.highImpressionsThreshold * 2) {
    priority = 'high'
  } else if (type === 'ctr_mismatch' && query.position <= 5) {
    priority = 'high'
  } else if (query.position > 15) {
    priority = 'low'
  }

  // Generate reasoning and suggestions based on type
  const { reasoning, suggestedAction, expectedImpact } = generateInsights(
    query,
    type,
    content,
    queryLower
  )

  return {
    query: query.query,
    type,
    priority,
    metrics: {
      impressions: query.impressions,
      clicks: query.clicks,
      ctr: query.ctr,
      position: query.position,
    },
    reasoning,
    suggestedAction,
    expectedImpact,
  }
}

/**
 * Generate human-readable insights
 */
function generateInsights(
  query: SearchConsoleQuery,
  type: OpportunityType,
  content: ContentIndex,
  queryLower: string
): { reasoning: string; suggestedAction: string; expectedImpact: string } {
  const positionStr = query.position.toFixed(1)
  const ctrStr = (query.ctr * 100).toFixed(1)

  switch (type) {
    case 'keyword_gap':
      return {
        reasoning: `De zoekterm "${query.query}" genereert ${query.impressions} impressies maar komt niet voor in de content. Google associeert je pagina al met dit onderwerp.`,
        suggestedAction: `Voeg "${query.query}" toe aan de content. Overweeg een nieuwe sectie of paragraaf die specifiek dit onderwerp behandelt.`,
        expectedImpact: `Door dit keyword toe te voegen kun je relevantie verhogen en mogelijk van positie ${positionStr} naar de top 5 stijgen.`,
      }

    case 'quick_win':
      return {
        reasoning: `Met positie ${positionStr} en ${query.impressions} impressies is dit een quick win. Je staat al op pagina 1 maar niet in de top 3.`,
        suggestedAction: `Versterk de relevantie voor "${query.query}" door het prominenter te plaatsen in title, H1, of eerste paragraaf.`,
        expectedImpact: `Een verbetering naar top 3 kan CTR verhogen van ${ctrStr}% naar 15-30%, wat ${Math.round(query.impressions * 0.2)} extra clicks kan opleveren.`,
      }

    case 'ranking_opportunity':
      return {
        reasoning: `Positie ${positionStr} betekent dat je op pagina 2 staat. Met ${query.impressions} impressies is er duidelijke zoekintentie.`,
        suggestedAction: `Optimaliseer content rondom "${query.query}": voeg toe aan headings, verhoog keyword density, en verbeter interne linking.`,
        expectedImpact: `Een stijging naar pagina 1 kan zichtbaarheid met 10x verhogen. Potentieel ${Math.round(query.impressions * 0.05)} extra clicks.`,
      }

    case 'ctr_mismatch':
      return {
        reasoning: `CTR van ${ctrStr}% is laag voor positie ${positionStr}. De SERP snippet overtuigt niet of matcht niet met zoekintentie.`,
        suggestedAction: `Herschrijf de meta description met "${query.query}" en een duidelijke call-to-action. Overweeg ook de title te optimaliseren.`,
        expectedImpact: `Een CTR verbetering naar 5% levert ${Math.round(query.impressions * 0.03)} extra clicks op zonder ranking verbetering.`,
      }

    case 'intent_mismatch':
      return {
        reasoning: `De zoekterm "${query.query}" suggereert een andere zoekintentie dan de huidige content biedt.`,
        suggestedAction: `Analyseer wat gebruikers zoeken met "${query.query}" en pas de content aan om beter aan te sluiten bij die behoefte.`,
        expectedImpact: `Betere intent-match verhoogt engagement, verlaagt bounce rate, en kan rankings significant verbeteren.`,
      }
  }
}

/**
 * Filter opportunities by minimum thresholds
 */
export function filterOpportunities(
  opportunities: KeywordOpportunity[],
  options: {
    impressionsMin?: number
    positionMin?: number
    positionMax?: number
    types?: OpportunityType[]
    priority?: ('high' | 'medium' | 'low')[]
    limit?: number
  } = {}
): KeywordOpportunity[] {
  let filtered = opportunities

  if (options.impressionsMin !== undefined) {
    filtered = filtered.filter((o) => o.metrics.impressions >= options.impressionsMin!)
  }

  if (options.positionMin !== undefined) {
    filtered = filtered.filter((o) => o.metrics.position >= options.positionMin!)
  }

  if (options.positionMax !== undefined) {
    filtered = filtered.filter((o) => o.metrics.position <= options.positionMax!)
  }

  if (options.types && options.types.length > 0) {
    filtered = filtered.filter((o) => options.types!.includes(o.type))
  }

  if (options.priority && options.priority.length > 0) {
    filtered = filtered.filter((o) => options.priority!.includes(o.priority))
  }

  if (options.limit !== undefined) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * Get high-signal keywords for LLM (pre-filtered)
 */
export function getHighSignalKeywords(
  analysis: KeywordAnalysisResult,
  maxKeywords: number = 20
): KeywordOpportunity[] {
  // Prioritize: high priority first, then by impressions
  return filterOpportunities(analysis.opportunities, {
    priority: ['high', 'medium'],
    limit: maxKeywords,
  })
}

export { buildContentIndex, detectOpportunityTypes, createOpportunity }
