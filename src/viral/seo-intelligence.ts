/**
 * SEO Intelligence Layer
 *
 * Provides search data integration for content opportunity prioritization.
 * This module acts as a DECISION layer, not just context enrichment.
 *
 * Two opportunity types:
 * - Demand Capture: proven search volume, blog-first
 * - Demand Creation: no search yet but high viral, social-first
 */

import { SearchConsoleClient } from '@/seo/search-console/client'
import { AhrefsClient, type AhrefsKeywordData } from '@/seo/ahrefs/client'
import type { SearchConsoleQuery } from '@/seo/types'

// ============================================
// Types
// ============================================

export type SearchIntent = 'informational' | 'commercial' | 'transactional'
export type OpportunityType = 'demand_capture' | 'demand_creation'
export type SearchDemandLevel = 'high' | 'medium' | 'low' | 'unknown'
export type CompetitiveDifficulty = 'easy' | 'medium' | 'hard' | 'unrealistic'
export type TrendDirection = 'rising' | 'stable' | 'declining'

export interface SearchIntelligence {
  // Do we have any search data?
  hasData: boolean

  // What data sources do we have?
  dataSources: {
    ahrefs: boolean   // Real search volume data
    gsc: boolean      // Where we already rank (for cannibalization)
  }

  // Ahrefs keyword data (REAL search demand)
  ahrefsData: AhrefsKeywordData | null

  // GSC queries (where we already rank - for cannibalization only)
  gscQueries: SearchQuery[]

  // Matched keywords (viral keywords matched to known search terms)
  matchedKeywords: MatchedKeyword[]

  // Aggregated metrics (from Ahrefs if available, otherwise GSC)
  searchVolume: number | null           // Real monthly search volume (Ahrefs)
  keywordDifficulty: number | null      // 0-100 (Ahrefs)
  totalImpressions: number              // GSC impressions (where WE rank)
  totalClicks: number
  bestPosition: number | null

  // Derived insights
  demandLevel: SearchDemandLevel
  opportunityType: OpportunityType
  primaryKeyword: string | null
  intent: SearchIntent
  trendDirection: TrendDirection
}

export interface SearchQuery {
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface MatchedKeyword {
  viralKeyword: string
  searchKeyword: string
  estimatedVolume: SearchDemandLevel
  matchConfidence: 'exact' | 'partial' | 'semantic'
}

// ============================================
// Strategic Gates
// ============================================

export type GateRisk = 'none' | 'reputation' | 'off-brand' | 'competitor-benefit' | 'negative-sentiment'
export type TopicalAction = 'new_cluster' | 'extend_cluster' | 'reject'
export type CannibalizationAction = 'create_new' | 'update_existing' | 'merge' | 'reject'

export interface StrategicGates {
  // Gate 1: Does this align with business intent?
  intentAlignment: {
    passed: boolean
    risk: GateRisk
    reason: string
  }

  // Gate 2: Does this fit our content strategy?
  topicalFit: {
    passed: boolean
    cluster: string | null
    action: TopicalAction
    reason: string
  }

  // Gate 3: Do we already have this content?
  cannibalization: {
    passed: boolean
    existingContentUrl: string | null
    action: CannibalizationAction
    reason: string
  }

  // Gate 4: Can we realistically win?
  competitiveViability: {
    passed: boolean
    difficulty: CompetitiveDifficulty
    reason: string
  }

  // Overall
  allPassed: boolean
  blockedBy: string | null
}

// ============================================
// Channel Scoring
// ============================================

export interface ChannelScores {
  blog: ChannelScore | null
  youtube: ChannelScore | null
  instagram: ChannelScore | null

  recommendedChannel: 'blog' | 'youtube' | 'instagram'
  recommendation: string
}

export interface ChannelScore {
  total: number
  breakdown: Record<string, number>
  viable: boolean
  rationale: string
}

// ============================================
// Search Context for Briefs (internal, camelCase version)
// For API serialization use SearchContext from ./schemas
// ============================================

export interface InternalSearchContext {
  // What is the searcher looking for?
  searcherQuestion: string

  // What's missing in current top results?
  competitiveGap: string

  // How do we differentiate?
  ourDifferentiator: string

  // What to avoid
  avoid: string[]

  // Primary query we're targeting
  primaryQuery: string

  // Intent classification
  intent: SearchIntent
}

// ============================================
// Intent Detection
// ============================================

const COMMERCIAL_PATTERNS = [
  /\b(kopen|bestellen|prijs|prijzen|kosten|tarief|tarieven|offerte|vergelijk)\b/i,
  /\b(buy|order|price|pricing|cost|quote|compare|vs|versus)\b/i,
  /\b(beste|top|review|reviews|ervaringen|beoordeling)\b/i,
  /\b(best|top|review|reviews|rating|rated)\b/i,
]

const TRANSACTIONAL_PATTERNS = [
  /\b(aanmelden|inschrijven|download|koop|bestel|reserveer|boek)\b/i,
  /\b(sign.?up|subscribe|download|buy|order|book|register|get.started)\b/i,
  /\b(gratis|free|trial|demo|cursus|training|workshop)\b/i,
]

const NEGATIVE_SENTIMENT_PATTERNS = [
  /\b(scam|fraud|oplicht|oplichter|waardeloos|slecht|falen|fail)\b/i,
  /\b(scam|fraud|fake|worthless|bad|terrible|worst|fail|fired|quit|stop)\b/i,
  /\b(waarom.*(niet|stop|quit|fail))\b/i,
  /\b(why.*(not|stop|quit|fail|fire))\b/i,
]

export function detectSearchIntent(text: string): SearchIntent {
  const lowerText = text.toLowerCase()

  // Check transactional first (most specific)
  for (const pattern of TRANSACTIONAL_PATTERNS) {
    if (pattern.test(lowerText)) return 'transactional'
  }

  // Check commercial
  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(lowerText)) return 'commercial'
  }

  // Default to informational
  return 'informational'
}

export function detectNegativeSentiment(text: string): boolean {
  const lowerText = text.toLowerCase()

  for (const pattern of NEGATIVE_SENTIMENT_PATTERNS) {
    if (pattern.test(lowerText)) return true
  }

  return false
}

// ============================================
// Strategic Gate Evaluation
// ============================================

export interface GateEvaluationInput {
  topic: string
  viralKeywords: string[]
  clientIndustry: string
  clientContext?: {
    brandValues?: string[]
    competitors?: string[]
    existingClusters?: string[]
    contentUrls?: { url: string; title: string; keywords: string[] }[]
  }
  searchIntelligence: SearchIntelligence
}

export function evaluateStrategicGates(input: GateEvaluationInput): StrategicGates {
  const gates: StrategicGates = {
    intentAlignment: evaluateIntentAlignment(input),
    topicalFit: evaluateTopicalFit(input),
    cannibalization: evaluateCannibalization(input),
    competitiveViability: evaluateCompetitiveViability(input),
    allPassed: true,
    blockedBy: null,
  }

  // Check if any gate failed
  if (!gates.intentAlignment.passed) {
    gates.allPassed = false
    gates.blockedBy = `Intent: ${gates.intentAlignment.reason}`
  } else if (!gates.topicalFit.passed) {
    gates.allPassed = false
    gates.blockedBy = `Topical fit: ${gates.topicalFit.reason}`
  } else if (!gates.cannibalization.passed) {
    gates.allPassed = false
    gates.blockedBy = `Cannibalization: ${gates.cannibalization.reason}`
  } else if (!gates.competitiveViability.passed) {
    gates.allPassed = false
    gates.blockedBy = `Competition: ${gates.competitiveViability.reason}`
  }

  return gates
}

function evaluateIntentAlignment(input: GateEvaluationInput): StrategicGates['intentAlignment'] {
  const { topic, viralKeywords, clientIndustry } = input
  const fullText = `${topic} ${viralKeywords.join(' ')}`

  // Check for negative sentiment that could harm brand
  if (detectNegativeSentiment(fullText)) {
    // Check if negativity is about the client's industry
    const industryKeywords = clientIndustry.toLowerCase().split(/\s+/)
    const hasIndustryMention = industryKeywords.some(kw =>
      fullText.toLowerCase().includes(kw)
    )

    if (hasIndustryMention) {
      return {
        passed: false,
        risk: 'reputation',
        reason: `Topic has negative sentiment about ${clientIndustry} - could harm brand`,
      }
    }

    return {
      passed: true,
      risk: 'negative-sentiment',
      reason: 'Topic has negative sentiment but not about client industry - proceed with caution',
    }
  }

  // Check if topic mentions competitors positively
  if (input.clientContext?.competitors) {
    for (const competitor of input.clientContext.competitors) {
      if (fullText.toLowerCase().includes(competitor.toLowerCase())) {
        return {
          passed: false,
          risk: 'competitor-benefit',
          reason: `Topic prominently features competitor: ${competitor}`,
        }
      }
    }
  }

  return {
    passed: true,
    risk: 'none',
    reason: 'Topic aligns with brand and business goals',
  }
}

function evaluateTopicalFit(input: GateEvaluationInput): StrategicGates['topicalFit'] {
  const { viralKeywords, clientContext } = input

  if (!clientContext?.existingClusters || clientContext.existingClusters.length === 0) {
    // No cluster strategy defined - allow anything
    return {
      passed: true,
      cluster: null,
      action: 'new_cluster',
      reason: 'No cluster strategy defined - topic allowed',
    }
  }

  // Check if topic fits existing clusters
  const viralKeywordSet = new Set(viralKeywords.map(k => k.toLowerCase()))

  for (const cluster of clientContext.existingClusters) {
    const clusterKeywords = cluster.toLowerCase().split(/\s+/)
    const overlap = clusterKeywords.filter(kw =>
      viralKeywordSet.has(kw) ||
      viralKeywords.some(vk => vk.toLowerCase().includes(kw))
    )

    if (overlap.length > 0) {
      return {
        passed: true,
        cluster,
        action: 'extend_cluster',
        reason: `Extends existing cluster: ${cluster}`,
      }
    }
  }

  // No cluster match - could be new cluster opportunity
  // For now, allow but flag as new cluster
  return {
    passed: true,
    cluster: null,
    action: 'new_cluster',
    reason: 'New topic area - consider if this should become a new cluster',
  }
}

function evaluateCannibalization(input: GateEvaluationInput): StrategicGates['cannibalization'] {
  const { viralKeywords, clientContext, searchIntelligence } = input

  if (!clientContext?.contentUrls || clientContext.contentUrls.length === 0) {
    return {
      passed: true,
      existingContentUrl: null,
      action: 'create_new',
      reason: 'No existing content database to check',
    }
  }

  // Check if we already have content targeting these keywords
  const viralKeywordSet = new Set(viralKeywords.map(k => k.toLowerCase()))

  for (const content of clientContext.contentUrls) {
    const contentKeywords = content.keywords.map(k => k.toLowerCase())
    const overlap = contentKeywords.filter(kw => viralKeywordSet.has(kw))

    // High overlap = potential cannibalization
    if (overlap.length >= 2) {
      // If we're already ranking well, update instead of create new
      if (searchIntelligence.bestPosition && searchIntelligence.bestPosition <= 10) {
        return {
          passed: false,
          existingContentUrl: content.url,
          action: 'update_existing',
          reason: `Already ranking #${searchIntelligence.bestPosition.toFixed(0)} with "${content.title}" - update instead`,
        }
      }

      // We have content but not ranking well - might need merge
      return {
        passed: true, // Allow, but flag
        existingContentUrl: content.url,
        action: 'merge',
        reason: `Similar content exists: "${content.title}" - consider consolidating`,
      }
    }
  }

  return {
    passed: true,
    existingContentUrl: null,
    action: 'create_new',
    reason: 'No conflicting content found',
  }
}

function evaluateCompetitiveViability(input: GateEvaluationInput): StrategicGates['competitiveViability'] {
  const { searchIntelligence } = input

  // If no search data, we can't assess competition - allow but flag as unknown
  if (!searchIntelligence.hasData) {
    return {
      passed: true,
      difficulty: 'medium', // Assume medium when unknown
      reason: 'No search data - competitive difficulty unknown',
    }
  }

  // Assess based on current position and demand
  const { bestPosition, demandLevel } = searchIntelligence

  // Already in top 10 = easy to optimize
  if (bestPosition && bestPosition <= 10) {
    return {
      passed: true,
      difficulty: 'easy',
      reason: `Already ranking #${bestPosition.toFixed(0)} - optimization opportunity`,
    }
  }

  // Position 11-30 with decent demand = medium difficulty
  if (bestPosition && bestPosition <= 30 && demandLevel !== 'low') {
    return {
      passed: true,
      difficulty: 'medium',
      reason: `Ranking #${bestPosition.toFixed(0)} with ${demandLevel} demand - growth opportunity`,
    }
  }

  // No ranking or position 30+ with low demand = harder
  if (!bestPosition && demandLevel === 'low') {
    return {
      passed: true,
      difficulty: 'hard',
      reason: 'Not ranking and low search demand - will need strong content',
    }
  }

  // High demand but not ranking = hard but worth it
  if (!bestPosition && (demandLevel === 'high' || demandLevel === 'medium')) {
    return {
      passed: true,
      difficulty: 'hard',
      reason: `High competition (${demandLevel} demand) but worth pursuing`,
    }
  }

  return {
    passed: true,
    difficulty: 'medium',
    reason: 'Standard competitive landscape',
  }
}

// ============================================
// Channel-Specific Scoring
// ============================================

export interface ChannelScoringInput {
  viralScore: number
  viralMomentum: TrendDirection
  totalEngagement: number
  searchIntelligence: SearchIntelligence
  strategicGates: StrategicGates
}

export function calculateChannelScores(input: ChannelScoringInput): ChannelScores {
  const blogScore = calculateBlogScore(input)
  const youtubeScore = calculateYouTubeScore(input)
  const instagramScore = calculateInstagramScore(input)

  // Determine recommended channel
  const scores = [
    { channel: 'blog' as const, score: blogScore },
    { channel: 'youtube' as const, score: youtubeScore },
    { channel: 'instagram' as const, score: instagramScore },
  ].filter(s => s.score?.viable)

  scores.sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))

  const recommended = scores[0]?.channel || 'youtube'

  let recommendation: string
  if (!blogScore?.viable && youtubeScore?.viable) {
    recommendation = 'Low search demand - focus on social channels for awareness'
  } else if (blogScore?.viable && blogScore.total > (youtubeScore?.total || 0)) {
    recommendation = 'Strong search opportunity - blog as primary, social for amplification'
  } else {
    recommendation = 'Balanced opportunity - lead with highest scoring channel'
  }

  return {
    blog: blogScore,
    youtube: youtubeScore,
    instagram: instagramScore,
    recommendedChannel: recommended,
    recommendation,
  }
}

function calculateBlogScore(input: ChannelScoringInput): ChannelScore | null {
  const { searchIntelligence, viralScore, strategicGates } = input

  // Blog scoring now uses Ahrefs for REAL search demand
  const hasAhrefsData = searchIntelligence.dataSources.ahrefs
  const hasGscData = searchIntelligence.dataSources.gsc

  // Demand levels from Ahrefs (real search volume)
  const hasSearchDemand = searchIntelligence.demandLevel === 'high' ||
                          searchIntelligence.demandLevel === 'medium'
  const hasLowDemand = searchIntelligence.demandLevel === 'low'
  const demandUnknown = searchIntelligence.demandLevel === 'unknown'

  const hasExceptionalViral = input.totalEngagement > 5000

  // Case 1: Ahrefs confirms LOW demand → block blog (unless exceptional viral)
  if (hasAhrefsData && hasLowDemand && !hasExceptionalViral) {
    const volume = searchIntelligence.searchVolume || 0
    return {
      total: 0,
      breakdown: {},
      viable: false,
      rationale: `Low search volume (${volume}/mo) - social channels recommended instead`,
    }
  }

  // Blog scoring: search-heavy (60% search, 25% viral validation, 15% strategic)
  const breakdown: Record<string, number> = {}

  // Search demand score (0-35) - Based on Ahrefs volume
  if (hasAhrefsData && hasSearchDemand) {
    const volume = searchIntelligence.searchVolume || 0
    if (volume >= 1000) {
      breakdown.searchDemand = 35  // High volume
    } else if (volume >= 100) {
      breakdown.searchDemand = 25  // Medium volume
    } else {
      breakdown.searchDemand = 15
    }
  } else if (demandUnknown) {
    // No Ahrefs data - demand creation opportunity
    breakdown.searchDemand = 15
  } else {
    breakdown.searchDemand = 5
  }

  // Keyword difficulty penalty (0 to -10)
  if (hasAhrefsData && searchIntelligence.keywordDifficulty !== null) {
    const kd = searchIntelligence.keywordDifficulty
    if (kd > 70) {
      breakdown.difficultyPenalty = -10  // Super hard
    } else if (kd > 50) {
      breakdown.difficultyPenalty = -5   // Hard
    } else {
      breakdown.difficultyPenalty = 0    // Easy/Medium
    }
  }

  // Position opportunity from GSC (0-25) - for cannibalization/quick wins
  if (hasGscData && searchIntelligence.bestPosition) {
    if (searchIntelligence.bestPosition <= 10) {
      breakdown.positionOpportunity = 25 // Quick win - already ranking
    } else if (searchIntelligence.bestPosition <= 20) {
      breakdown.positionOpportunity = 20 // Growth opportunity
    } else if (searchIntelligence.bestPosition <= 50) {
      breakdown.positionOpportunity = 10
    } else {
      breakdown.positionOpportunity = 5
    }
  } else {
    // Not ranking yet - new territory
    breakdown.positionOpportunity = 15
  }

  // Viral validation (0-20)
  breakdown.viralValidation = Math.min(20, Math.round(viralScore * 0.25))

  // Strategic fit (0-20)
  breakdown.strategicFit = strategicGates.allPassed ? 20 : 10

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

  // Build rationale based on data sources
  let rationale: string
  if (hasAhrefsData && hasSearchDemand) {
    const volume = searchIntelligence.searchVolume || 0
    const kd = searchIntelligence.keywordDifficulty || 0
    rationale = `Strong blog opportunity - ${volume}/mo search volume, KD ${kd}`
  } else if (hasAhrefsData) {
    const volume = searchIntelligence.searchVolume || 0
    rationale = `Blog allowed despite lower volume (${volume}/mo) due to viral validation`
  } else if (hasGscData && !hasAhrefsData) {
    rationale = 'Blog opportunity (GSC data only) - add AHREFS_API_TOKEN for real search volume'
  } else {
    rationale = 'Demand creation opportunity - no search data yet, viral-first approach'
  }

  return {
    total,
    breakdown,
    viable: true,
    rationale,
  }
}

function calculateYouTubeScore(input: ChannelScoringInput): ChannelScore | null {
  const { viralScore, viralMomentum, totalEngagement, searchIntelligence, strategicGates } = input

  // YouTube scoring: viral-heavy (50% viral, 25% topic appeal, 15% search, 10% strategic)
  const breakdown: Record<string, number> = {}

  // Viral momentum (0-40)
  let viralPoints = Math.min(30, Math.round(viralScore * 0.4))
  if (viralMomentum === 'rising') viralPoints += 10
  else if (viralMomentum === 'stable') viralPoints += 5
  breakdown.viralMomentum = Math.min(40, viralPoints)

  // Topic appeal / storytelling potential (0-25)
  // Higher engagement usually means more discussion = more story potential
  if (totalEngagement > 5000) {
    breakdown.topicAppeal = 25
  } else if (totalEngagement > 1000) {
    breakdown.topicAppeal = 20
  } else if (totalEngagement > 500) {
    breakdown.topicAppeal = 15
  } else {
    breakdown.topicAppeal = 10
  }

  // Search tailwind (0-17.5)
  if (searchIntelligence.hasData && searchIntelligence.demandLevel !== 'low') {
    if (searchIntelligence.demandLevel === 'high') {
      breakdown.searchTailwind = 17
    } else if (searchIntelligence.demandLevel === 'medium') {
      breakdown.searchTailwind = 12
    } else {
      breakdown.searchTailwind = 5
    }
  } else {
    breakdown.searchTailwind = 0
  }

  // Strategic fit (0-17.5)
  breakdown.strategicFit = strategicGates.allPassed ? 17 : 8

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

  return {
    total,
    breakdown,
    viable: total >= 30, // Lower threshold for YouTube
    rationale: total >= 60
      ? 'Strong YouTube opportunity with viral momentum'
      : 'Moderate YouTube opportunity - focus on hook and storytelling',
  }
}

function calculateInstagramScore(input: ChannelScoringInput): ChannelScore | null {
  const { viralScore, viralMomentum, totalEngagement, strategicGates } = input

  // Instagram scoring: trend-heavy (55% viral recency, 25% visual potential, 20% strategic)
  const breakdown: Record<string, number> = {}

  // Viral recency (0-45)
  let recencyPoints = Math.min(35, Math.round(viralScore * 0.45))
  if (viralMomentum === 'rising') recencyPoints += 10
  breakdown.viralRecency = Math.min(45, recencyPoints)

  // Visual/carousel potential (0-25)
  // Topics with multiple angles work well for carousels
  if (totalEngagement > 3000) {
    breakdown.visualPotential = 25
  } else if (totalEngagement > 1000) {
    breakdown.visualPotential = 20
  } else {
    breakdown.visualPotential = 15
  }

  // Trend alignment (0-15)
  breakdown.trendAlignment = viralMomentum === 'rising' ? 15 : viralMomentum === 'stable' ? 10 : 5

  // Strategic fit (0-15)
  breakdown.strategicFit = strategicGates.allPassed ? 15 : 7

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

  return {
    total,
    breakdown,
    viable: total >= 30,
    rationale: total >= 55
      ? 'Strong Instagram opportunity - high trending potential'
      : 'Moderate Instagram opportunity - ensure strong visual hook',
  }
}

// ============================================
// Search Intelligence Builder
// ============================================

export interface BuildSearchIntelligenceOptions {
  viralKeywords: string[]
  topic: string                     // Main topic to search for
  siteUrl?: string                  // For GSC cannibalization check
  gscClient?: SearchConsoleClient   // GSC client (for cannibalization)
  ahrefsClient?: AhrefsClient | null // Ahrefs client (for real demand)
}

export async function buildSearchIntelligence(
  options: BuildSearchIntelligenceOptions
): Promise<SearchIntelligence> {
  const { viralKeywords, topic, siteUrl, gscClient, ahrefsClient } = options

  let gscQueries: SearchQuery[] = []
  let ahrefsData: AhrefsKeywordData | null = null

  // 1. Try to get Ahrefs data for REAL search demand
  if (ahrefsClient) {
    try {
      // Create search query from topic and viral keywords
      const searchKeyword = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
      ahrefsData = await ahrefsClient.getSingleKeyword(searchKeyword)

      if (!ahrefsData && viralKeywords.length > 0) {
        // Try with first viral keyword
        const altKeyword = viralKeywords[0].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
        ahrefsData = await ahrefsClient.getSingleKeyword(altKeyword)
      }
    } catch (error) {
      console.warn('[SEO Intelligence] Failed to fetch Ahrefs data:', error)
    }
  }

  // 2. Try to get GSC data for CANNIBALIZATION check (not demand!)
  if (siteUrl && gscClient) {
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() - 3) // GSC has 3-day delay

      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 28)

      const rawQueries = await gscClient.query({
        siteUrl,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 500,
      })

      // Filter to relevant queries (matching viral keywords)
      const keywordSet = new Set(viralKeywords.map(k => k.toLowerCase()))

      gscQueries = rawQueries
        .filter(q => {
          const queryWords = q.query.toLowerCase().split(/\s+/)
          return queryWords.some(w => keywordSet.has(w)) ||
                 viralKeywords.some(vk => q.query.toLowerCase().includes(vk.toLowerCase()))
        })
        .map(q => ({
          query: q.query,
          impressions: q.impressions,
          clicks: q.clicks,
          ctr: q.ctr,
          position: q.position,
        }))
    } catch (error) {
      console.warn('[SEO Intelligence] Failed to fetch GSC data:', error)
    }
  }

  // Calculate GSC aggregates (for cannibalization only)
  const totalImpressions = gscQueries.reduce((sum, q) => sum + q.impressions, 0)
  const totalClicks = gscQueries.reduce((sum, q) => sum + q.clicks, 0)
  const bestPosition = gscQueries.length > 0
    ? Math.min(...gscQueries.map(q => q.position))
    : null

  // Determine demand level from AHREFS (real search volume), NOT GSC
  let demandLevel: SearchDemandLevel
  if (ahrefsData) {
    // Use real search volume from Ahrefs
    const ahrefsDemand = AhrefsClient.categorizeDemand(ahrefsData.volume)
    // Map 'none' to 'low' since both indicate insufficient search demand
    demandLevel = ahrefsDemand === 'none' ? 'low' : ahrefsDemand
  } else {
    // No Ahrefs data - demand is unknown
    // NOTE: We deliberately do NOT fall back to GSC impressions as that's NOT search volume
    demandLevel = 'unknown'
  }

  // Determine opportunity type based on REAL demand
  const opportunityType: OpportunityType = demandLevel === 'high' || demandLevel === 'medium'
    ? 'demand_capture'
    : 'demand_creation'

  // Get primary keyword
  const primaryKeyword = ahrefsData?.keyword ||
    (gscQueries.length > 0
      ? gscQueries.reduce((best, q) => q.impressions > best.impressions ? q : best).query
      : null)

  // Detect intent from primary keyword or viral keywords
  const textForIntent = primaryKeyword || viralKeywords.join(' ')
  const intent = detectSearchIntent(textForIntent)

  const hasAhrefsData = ahrefsData !== null
  const hasGscData = gscQueries.length > 0

  return {
    hasData: hasAhrefsData || hasGscData,
    dataSources: {
      ahrefs: hasAhrefsData,
      gsc: hasGscData,
    },
    ahrefsData,
    gscQueries,
    matchedKeywords: [],
    searchVolume: ahrefsData?.volume || null,
    keywordDifficulty: ahrefsData?.difficulty || null,
    totalImpressions,
    totalClicks,
    bestPosition,
    demandLevel,
    opportunityType,
    primaryKeyword,
    intent,
    trendDirection: 'stable', // TODO: Integrate Google Trends
  }
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use buildSearchIntelligence with options object instead
 */
export async function buildSearchIntelligenceLegacy(
  viralKeywords: string[],
  siteUrl?: string,
  gscClient?: SearchConsoleClient
): Promise<SearchIntelligence> {
  return buildSearchIntelligence({
    viralKeywords,
    topic: viralKeywords[0] || '',
    siteUrl,
    gscClient,
    ahrefsClient: AhrefsClient.fromEnv(),
  })
}

// ============================================
// Search Context Builder (for Briefs)
// ============================================

export function buildSearchContext(
  searchIntelligence: SearchIntelligence,
  viralContext: { topic: string; coreDiscussion: string }
): InternalSearchContext | null {
  // Only build search context if we have search data
  if (!searchIntelligence.hasData || searchIntelligence.demandLevel === 'unknown') {
    return null
  }

  const primaryQuery = searchIntelligence.primaryKeyword || viralContext.topic

  // Build searcher question based on intent
  let searcherQuestion: string
  switch (searchIntelligence.intent) {
    case 'transactional':
      searcherQuestion = `Mensen zoeken naar "${primaryQuery}" om actie te ondernemen - ze willen iets kopen, aanmelden, of starten`
      break
    case 'commercial':
      searcherQuestion = `Mensen vergelijken opties rondom "${primaryQuery}" - ze willen de beste keuze maken`
      break
    default:
      searcherQuestion = `Mensen willen begrijpen/leren over "${primaryQuery}" - ze zoeken informatie en antwoorden`
  }

  // Competitive gap - based on viral discussion vs typical search results
  const competitiveGap = `De virale discussie gaat over: "${viralContext.coreDiscussion.substring(0, 100)}..." - ` +
    `typische zoekresultaten missen waarschijnlijk deze actuele invalshoek`

  // Our differentiator
  const ourDifferentiator = `Wij combineren actuele discussies (${searchIntelligence.totalImpressions} impressies) ` +
    `met de echte vragen die mensen stellen`

  return {
    primaryQuery,
    intent: searchIntelligence.intent,
    searcherQuestion,
    competitiveGap,
    ourDifferentiator,
    avoid: [
      'Geen generieke content die niet ingaat op de actuele discussie',
      'Niet focussen op keywords ten koste van leesbaarheid',
    ],
  }
}
