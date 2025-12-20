/**
 * Viral Opportunity Builder
 *
 * Transforms raw signals into ranked content opportunities.
 * Uses clustering, scoring, and optional AI synthesis.
 *
 * V2: Integrates SEO intelligence for demand-aware prioritization.
 * - Strategic gates prevent bad content decisions
 * - Channel-specific scoring (blog ≠ youtube ≠ instagram)
 * - Search context flows through to briefs
 */

import { createClient } from '@/lib/supabase/server'
import { aiGateway } from '@/lib/ai/gateway'
import type { NormalizedSignal, ViralSourceType } from './sources'
import type { AITask } from '@/lib/ai/types'
import {
  buildSearchIntelligence,
  evaluateStrategicGates,
  calculateChannelScores,
  buildSearchContext,
  type SearchIntelligence,
  type StrategicGates,
  type ChannelScores,
  type InternalSearchContext,
} from './seo-intelligence'

// PERFORMANCE: Batch size for database operations
const BATCH_SIZE = 50
import { SearchConsoleClient } from '@/seo/search-console/client'
import { AhrefsClient } from '@/seo/ahrefs/client'

// ============================================
// Types
// ============================================

export type ViralChannel = 'youtube' | 'instagram' | 'blog'
export type OpportunityStatus = 'new' | 'shortlisted' | 'generated' | 'archived'

export interface BuildOpportunitiesConfig {
  industry: string
  clientId?: string
  channels: ViralChannel[]
  limit?: number
  days?: number
  useAI?: boolean
  // V2: SEO integration options
  seoOptions?: {
    enabled: boolean
    siteUrl?: string           // For GSC data lookup
    enforceGates?: boolean     // Block opportunities that fail gates (default: true)
    existingClusters?: string[] // Client's topical clusters
    existingContent?: { url: string; title: string; keywords: string[] }[]
    competitors?: string[]
  }
}

export interface Opportunity {
  id?: string
  clientId?: string
  industry: string
  channel: ViralChannel
  topic: string
  angle: string
  hook: string
  reasoning: string
  score: number
  scoreBreakdown: ScoreBreakdown
  sourceSignalIds: string[]
  status: OpportunityStatus
  createdAt?: string
  // V2: SEO intelligence
  seoData?: {
    searchIntelligence: SearchIntelligence
    strategicGates: StrategicGates
    channelScores: ChannelScores
    searchContext: InternalSearchContext | null
    opportunityType: 'demand_capture' | 'demand_creation'
  }
}

export interface ScoreBreakdown {
  engagement: number     // 0-30: Based on upvotes, comments
  freshness: number      // 0-20: Time decay
  relevance: number      // 0-25: Keyword match to industry
  novelty: number        // 0-15: Not seen similar recently
  seasonality: number    // 0-10: Matches current time/events
}

interface SignalCluster {
  signals: SignalWithId[]
  keywords: string[]
  totalEngagement: number
}

interface SignalWithId {
  id: string
  signal: NormalizedSignal
}

// ============================================
// Constants
// ============================================

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her',
  'our', 'their', 'what', 'which', 'who', 'whom', 'how', 'why', 'when', 'where',
  'just', 'like', 'get', 'got', 'really', 'very', 'so', 'now', 'new', 'more',
  'no', 'not', 'any', 'all', 'some', 'about', 'out', 'up', 'down', 'into',
])

const CLUSTER_MIN_SIGNALS = 1  // Allow single-signal opportunities
const HIGH_ENGAGEMENT_THRESHOLD = 100  // Signals with 100+ upvotes can stand alone
const DEFAULT_LIMIT = 10
const DEFAULT_DAYS = 7

// ============================================
// Main Builder Function
// ============================================

export async function buildOpportunities(
  config: BuildOpportunitiesConfig
): Promise<Opportunity[]> {
  const supabase = await createClient()
  const limit = config.limit || DEFAULT_LIMIT
  const days = config.days || DEFAULT_DAYS
  const seoEnabled = config.seoOptions?.enabled ?? false
  const enforceGates = config.seoOptions?.enforceGates ?? true

  // 1. Fetch recent signals for industry
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  console.log(`[Opportunities] Fetching signals for industry="${config.industry}", since=${cutoffDate}`)

  const { data: signals, error: fetchError } = await supabase
    .from('viral_signals')
    .select('*')
    .eq('industry', config.industry)
    .gte('fetched_at', cutoffDate)
    .order('fetched_at', { ascending: false })
    .limit(200)

  if (fetchError) {
    console.error('[Opportunities] Error fetching signals:', fetchError)
    return []
  }

  console.log(`[Opportunities] Found ${signals?.length || 0} signals`)

  if (!signals || signals.length === 0) {
    return []
  }

  // 2. Convert to SignalWithId format
  const signalsWithIds: SignalWithId[] = signals.map(row => ({
    id: row.id,
    signal: {
      sourceType: row.source_type as ViralSourceType,
      externalId: row.external_id,
      url: row.url,
      title: row.title,
      author: row.author,
      community: row.community,
      createdAtExternal: row.created_at_external ? new Date(row.created_at_external) : undefined,
      metrics: row.metrics as NormalizedSignal['metrics'],
      rawExcerpt: row.raw_excerpt,
      industry: row.industry,
    },
  }))

  // 2b. Initialize SEO clients if SEO is enabled
  let gscClient: SearchConsoleClient | undefined
  let ahrefsClient: AhrefsClient | null = null

  if (seoEnabled) {
    // Ahrefs for REAL search demand (volume, difficulty)
    ahrefsClient = AhrefsClient.fromEnv()
    if (ahrefsClient) {
      console.log('[Opportunities] Ahrefs client initialized - real search volume available')
    } else {
      console.log('[Opportunities] No Ahrefs API token - search demand will be unknown')
    }

    // GSC for cannibalization check only (where we already rank)
    if (config.seoOptions?.siteUrl) {
      try {
        gscClient = SearchConsoleClient.fromEnv()
        console.log('[Opportunities] GSC client initialized - cannibalization check available')
      } catch (error) {
        console.warn('[Opportunities] GSC client initialization failed:', error)
      }
    }
  }

  // 3. Separate high-engagement signals (they stand alone) from others
  const standaloneSignals: SignalWithId[] = []
  const clusterableSignals: SignalWithId[] = []

  for (const signalWithId of signalsWithIds) {
    const upvotes = signalWithId.signal.metrics.upvotes || 0
    if (upvotes >= HIGH_ENGAGEMENT_THRESHOLD) {
      standaloneSignals.push(signalWithId)
    } else {
      clusterableSignals.push(signalWithId)
    }
  }

  console.log(`[Opportunities] Standalone: ${standaloneSignals.length}, Clusterable: ${clusterableSignals.length}`)

  // 4. Generate opportunities with SEO intelligence
  // PERFORMANCE: Process standalone signals and clusters in parallel

  // 4a. Prepare standalone signal clusters
  const standaloneClusters: SignalCluster[] = standaloneSignals.map(signalWithId => ({
    signals: [signalWithId],
    keywords: Array.from(extractKeywords(signalWithId.signal.title)),
    totalEngagement: signalWithId.signal.metrics.upvotes || 0,
  }))

  // 4b. Cluster remaining low-engagement signals
  const clusters = clusterSignals(clusterableSignals)
    .filter(cluster => cluster.signals.length >= CLUSTER_MIN_SIGNALS)
  console.log(`[Opportunities] Created ${clusters.length} clusters from clusterable signals`)

  // 4c. Combine all clusters and process in parallel
  const allClusters = [...standaloneClusters, ...clusters]
  console.log(`[Opportunities] Processing ${allClusters.length} total clusters in parallel`)

  // Process in parallel batches to avoid overwhelming external APIs
  const PARALLEL_BATCH = 5
  const allOpportunitiesArrays: Opportunity[][] = []

  for (let i = 0; i < allClusters.length; i += PARALLEL_BATCH) {
    const batch = allClusters.slice(i, i + PARALLEL_BATCH)
    const batchResults = await Promise.all(
      batch.map(cluster =>
        createOpportunitiesFromClusterV2(cluster, config, gscClient, ahrefsClient)
      )
    )
    allOpportunitiesArrays.push(...batchResults)
  }

  // Flatten and filter opportunities
  const opportunities: Opportunity[] = []
  for (const clusterOpportunities of allOpportunitiesArrays) {
    for (const opp of clusterOpportunities) {
      if (enforceGates && opp.seoData && !opp.seoData.strategicGates.allPassed) {
        console.log(`Opportunity blocked: ${opp.topic} - ${opp.seoData.strategicGates.blockedBy}`)
        continue
      }
      opportunities.push(opp)
    }
  }

  console.log(`[Opportunities] Total opportunities created: ${opportunities.length}`)

  // 5. Sort by score and limit
  opportunities.sort((a, b) => b.score - a.score)
  const topOpportunities = opportunities.slice(0, limit)

  // 6. Optionally enhance with AI
  if (config.useAI && topOpportunities.length > 0) {
    await enhanceOpportunitiesWithAI(topOpportunities, config.industry)
  }

  // 7. Store opportunities - PERFORMANCE: Batch insert
  console.log(`[Opportunities] Storing ${topOpportunities.length} opportunities...`)

  const recordsToInsert = topOpportunities.map(opp => ({
    client_id: opp.clientId,
    industry: opp.industry,
    channel: opp.channel,
    topic: opp.topic,
    angle: opp.angle,
    hook: opp.hook,
    reasoning: opp.reasoning,
    score: opp.score,
    score_breakdown: opp.scoreBreakdown,
    source_signal_ids: opp.sourceSignalIds,
    status: 'new' as const,
  }))

  const storedOpportunities: Opportunity[] = []

  // Batch insert in chunks of BATCH_SIZE
  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE)
    const originalBatch = topOpportunities.slice(i, i + BATCH_SIZE)

    const { data: inserted, error } = await supabase
      .from('viral_opportunities')
      .insert(batch)
      .select('id, created_at')

    if (error) {
      console.error(`[Opportunities] Batch insert error:`, error.message)
      continue
    }

    if (inserted) {
      for (let j = 0; j < inserted.length; j++) {
        storedOpportunities.push({
          ...originalBatch[j],
          id: inserted[j].id,
          createdAt: inserted[j].created_at,
        })
      }
    }
  }

  console.log(`[Opportunities] Successfully stored ${storedOpportunities.length} opportunities`)
  return storedOpportunities
}

/**
 * V2: Create opportunities with SEO intelligence
 * Returns opportunities for each viable channel (not all requested channels)
 */
async function createOpportunitiesFromClusterV2(
  cluster: SignalCluster,
  config: BuildOpportunitiesConfig,
  gscClient?: SearchConsoleClient,
  ahrefsClient?: AhrefsClient | null
): Promise<Opportunity[]> {
  const seoEnabled = config.seoOptions?.enabled ?? false

  // If SEO not enabled, fall back to original behavior
  if (!seoEnabled) {
    return config.channels.map(channel =>
      createOpportunityFromCluster(cluster, config.industry, channel, config.clientId)
    )
  }

  // Build search intelligence from cluster keywords
  // Now uses Ahrefs for REAL search volume, GSC only for cannibalization
  const searchIntelligence = await buildSearchIntelligence({
    viralKeywords: cluster.keywords,
    topic: cluster.keywords.join(' '),
    siteUrl: config.seoOptions?.siteUrl,
    gscClient,
    ahrefsClient,
  })

  // Evaluate strategic gates
  const strategicGates = evaluateStrategicGates({
    topic: cluster.keywords.join(' '),
    viralKeywords: cluster.keywords,
    clientIndustry: config.industry,
    clientContext: {
      existingClusters: config.seoOptions?.existingClusters,
      contentUrls: config.seoOptions?.existingContent,
      competitors: config.seoOptions?.competitors,
    },
    searchIntelligence,
  })

  // Calculate viral score for channel scoring
  const viralScoreBreakdown = calculateScore(cluster, config.industry)
  const viralScore = Object.values(viralScoreBreakdown).reduce((sum, val) => sum + val, 0)

  // Calculate channel-specific scores
  const channelScores = calculateChannelScores({
    viralScore,
    viralMomentum: searchIntelligence.trendDirection,
    totalEngagement: cluster.totalEngagement,
    searchIntelligence,
    strategicGates,
  })

  // Build search context for briefs
  const topSignal = cluster.signals.reduce((best, current) =>
    (current.signal.metrics.upvotes || 0) > (best.signal.metrics.upvotes || 0) ? current : best
  )
  const searchContext = buildSearchContext(searchIntelligence, {
    topic: cluster.keywords.join(' '),
    coreDiscussion: topSignal.signal.rawExcerpt || topSignal.signal.title,
  })

  // Create opportunities only for viable channels
  const opportunities: Opportunity[] = []

  for (const channel of config.channels) {
    const channelScore = channelScores[channel]

    // Skip non-viable channels
    if (!channelScore?.viable) {
      console.log(`Channel ${channel} not viable for topic: ${cluster.keywords.join(' ')}`)
      continue
    }

    const baseOpportunity = createOpportunityFromCluster(
      cluster,
      config.industry,
      channel,
      config.clientId
    )

    // Override score with channel-specific score
    const enhancedOpportunity: Opportunity = {
      ...baseOpportunity,
      score: channelScore.total,
      reasoning: enhanceReasoning(baseOpportunity.reasoning, channelScore, searchIntelligence),
      seoData: {
        searchIntelligence,
        strategicGates,
        channelScores,
        searchContext,
        opportunityType: searchIntelligence.opportunityType,
      },
    }

    opportunities.push(enhancedOpportunity)
  }

  // If no channels are viable but gates passed, create for recommended channel
  if (opportunities.length === 0 && strategicGates.allPassed) {
    const fallbackChannel = channelScores.recommendedChannel
    const baseOpportunity = createOpportunityFromCluster(
      cluster,
      config.industry,
      fallbackChannel,
      config.clientId
    )

    opportunities.push({
      ...baseOpportunity,
      reasoning: `${baseOpportunity.reasoning} (Recommended: ${channelScores.recommendation})`,
      seoData: {
        searchIntelligence,
        strategicGates,
        channelScores,
        searchContext,
        opportunityType: searchIntelligence.opportunityType,
      },
    })
  }

  return opportunities
}

/**
 * Enhance reasoning with SEO insights
 */
function enhanceReasoning(
  baseReasoning: string,
  channelScore: { total: number; rationale: string },
  searchIntelligence: SearchIntelligence
): string {
  const parts = [baseReasoning]

  if (searchIntelligence.hasData) {
    if (searchIntelligence.demandLevel === 'high') {
      parts.push(`High search demand (${searchIntelligence.totalImpressions.toLocaleString()} impressions)`)
    } else if (searchIntelligence.demandLevel === 'medium') {
      parts.push(`Moderate search demand detected`)
    }

    if (searchIntelligence.bestPosition && searchIntelligence.bestPosition <= 20) {
      parts.push(`Already ranking #${searchIntelligence.bestPosition.toFixed(0)} - optimization opportunity`)
    }
  } else {
    parts.push('Demand creation opportunity - viral-first strategy')
  }

  parts.push(channelScore.rationale)

  return parts.join('. ')
}

// ============================================
// Clustering
// ============================================

function clusterSignals(signals: SignalWithId[]): SignalCluster[] {
  // Extract keywords from each signal
  const signalKeywords: Map<string, Set<string>> = new Map()

  for (const { id, signal } of signals) {
    const keywords = extractKeywords(signal.title)
    signalKeywords.set(id, keywords)
  }

  // Group by shared keywords
  const clusters: SignalCluster[] = []
  const assignedSignals = new Set<string>()

  for (const { id, signal } of signals) {
    if (assignedSignals.has(id)) continue

    const keywords = signalKeywords.get(id)!
    const cluster: SignalCluster = {
      signals: [{ id, signal }],
      keywords: Array.from(keywords),
      totalEngagement: signal.metrics.upvotes || 0,
    }

    // Find similar signals
    for (const { id: otherId, signal: otherSignal } of signals) {
      if (id === otherId || assignedSignals.has(otherId)) continue

      const otherKeywords = signalKeywords.get(otherId)!
      const overlap = countOverlap(keywords, otherKeywords)

      // If enough keyword overlap, add to cluster
      if (overlap >= 2 || (overlap >= 1 && keywords.size <= 3)) {
        cluster.signals.push({ id: otherId, signal: otherSignal })
        cluster.totalEngagement += otherSignal.metrics.upvotes || 0
        assignedSignals.add(otherId)

        // Merge keywords
        otherKeywords.forEach(kw => {
          if (!cluster.keywords.includes(kw)) {
            cluster.keywords.push(kw)
          }
        })
      }
    }

    assignedSignals.add(id)
    clusters.push(cluster)
  }

  // Sort clusters by total engagement
  clusters.sort((a, b) => b.totalEngagement - a.totalEngagement)

  return clusters
}

function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word))

  return new Set(words)
}

function countOverlap(set1: Set<string>, set2: Set<string>): number {
  let count = 0
  set1.forEach(item => {
    if (set2.has(item)) count++
  })
  return count
}

// ============================================
// Opportunity Creation
// ============================================

function createOpportunityFromCluster(
  cluster: SignalCluster,
  industry: string,
  channel: ViralChannel,
  clientId?: string
): Opportunity {
  // Get the top signal for the main topic
  const topSignal = cluster.signals.reduce((best, current) =>
    (current.signal.metrics.upvotes || 0) > (best.signal.metrics.upvotes || 0) ? current : best
  )

  // Score the opportunity
  const scoreBreakdown = calculateScore(cluster, industry)
  const totalScore = Object.values(scoreBreakdown).reduce((sum, val) => sum + val, 0)

  // Generate topic/angle/hook based on cluster
  const topic = cluster.keywords.slice(0, 3).join(' + ')
  const angle = generateAngle(topSignal.signal, channel)
  const hook = generateHook(topSignal.signal, channel)
  const reasoning = generateReasoning(cluster, scoreBreakdown)

  return {
    clientId,
    industry,
    channel,
    topic,
    angle,
    hook,
    reasoning,
    score: Math.min(100, Math.round(totalScore)),
    scoreBreakdown,
    sourceSignalIds: cluster.signals.map(s => s.id),
    status: 'new',
  }
}

function calculateScore(cluster: SignalCluster, industry: string): ScoreBreakdown {
  const isSingleSignal = cluster.signals.length === 1

  // Engagement Score (0-30)
  const avgUpvotes = cluster.totalEngagement / cluster.signals.length
  const avgComments = cluster.signals.reduce(
    (sum, s) => sum + (s.signal.metrics.comments || 0), 0
  ) / cluster.signals.length

  const engagementScore = Math.min(30, Math.round(
    (Math.log10(avgUpvotes + 1) * 5) +
    (Math.log10(avgComments + 1) * 3)
  ))

  // Freshness Score (0-20)
  const avgAge = cluster.signals.reduce((sum, s) => {
    const created = s.signal.createdAtExternal || new Date()
    return sum + (Date.now() - created.getTime())
  }, 0) / cluster.signals.length

  const ageHours = avgAge / (1000 * 60 * 60)
  const freshnessScore = Math.max(0, Math.round(20 - (ageHours / 12)))

  // Relevance Score (0-25)
  const industryKeywords = industry.toLowerCase().split(/\s+/)
  let keywordMatches = 0
  for (const kw of cluster.keywords) {
    if (industryKeywords.some(ik => kw.includes(ik) || ik.includes(kw))) {
      keywordMatches++
    }
  }
  const relevanceScore = Math.min(25, keywordMatches * 8)

  // Novelty Score (0-15)
  // For single high-engagement signals: reward based on comment engagement ratio
  // For clusters: reward diversity across communities
  let noveltyScore: number
  if (isSingleSignal) {
    const signal = cluster.signals[0].signal
    const upvotes = signal.metrics.upvotes || 0
    const comments = signal.metrics.comments || 0
    // High comment-to-upvote ratio indicates rich discussion potential
    const commentRatio = upvotes > 0 ? comments / upvotes : 0
    noveltyScore = Math.min(15, Math.round(commentRatio * 50) + 5)
  } else {
    const uniqueCommunities = new Set(cluster.signals.map(s => s.signal.community)).size
    noveltyScore = Math.min(15, uniqueCommunities * 5)
  }

  // Seasonality Score (0-10) - Simplified for MVP
  const seasonalityScore = 5  // Default mid-score

  return {
    engagement: engagementScore,
    freshness: freshnessScore,
    relevance: relevanceScore,
    novelty: noveltyScore,
    seasonality: seasonalityScore,
  }
}

function generateAngle(signal: NormalizedSignal, channel: ViralChannel): string {
  const title = signal.title

  switch (channel) {
    case 'youtube':
      return `Deep dive into "${title.substring(0, 50)}..." - What everyone is missing`
    case 'instagram':
      return `Quick take on ${title.substring(0, 30)}... - Carousel breakdown`
    case 'blog':
      return `Complete guide: ${title.substring(0, 40)}... - Analysis and insights`
    default:
      return title.substring(0, 60)
  }
}

function generateHook(signal: NormalizedSignal, channel: ViralChannel): string {
  const upvotes = signal.metrics.upvotes || 0
  const comments = signal.metrics.comments || 0

  switch (channel) {
    case 'youtube':
      return `This is blowing up right now (${upvotes.toLocaleString()} engaged, ${comments} comments). Here's what you need to know...`
    case 'instagram':
      return `${upvotes.toLocaleString()}+ people are talking about this. Here's the breakdown:`
    case 'blog':
      return `With ${upvotes.toLocaleString()} engaged readers and ${comments} discussions, this topic is trending. Let's analyze why.`
    default:
      return `Trending topic with high engagement`
  }
}

function generateReasoning(cluster: SignalCluster, scores: ScoreBreakdown): string {
  const parts: string[] = []

  if (scores.engagement >= 20) {
    parts.push(`Strong engagement (${cluster.totalEngagement.toLocaleString()} total upvotes)`)
  }
  if (scores.freshness >= 15) {
    parts.push('Fresh topic gaining momentum')
  }
  if (scores.relevance >= 15) {
    parts.push('Highly relevant to industry')
  }
  if (scores.novelty >= 10) {
    parts.push('Cross-community interest')
  }

  return parts.length > 0
    ? parts.join('. ') + '.'
    : 'Moderate potential based on current engagement patterns.'
}

// ============================================
// AI Enhancement
// ============================================

async function enhanceOpportunitiesWithAI(
  opportunities: Opportunity[],
  industry: string
): Promise<void> {
  // Prepare signal summaries for AI
  const signalSummaries = opportunities.slice(0, 5).map(opp => ({
    topic: opp.topic,
    angle: opp.angle,
    score: opp.score,
    engagement: opp.scoreBreakdown.engagement,
  }))

  try {
    const result = await aiGateway.generateText<{
      enhanced: Array<{
        topic: string
        angle: string
        hook: string
        reasoning: string
      }>
    }>({
      task: 'viral_topic_synthesis' as AITask,
      input: {
        industry,
        signals: JSON.stringify(signalSummaries),
      },
    })

    if (result.success && result.data?.enhanced) {
      // Apply AI enhancements
      for (let i = 0; i < Math.min(opportunities.length, result.data.enhanced.length); i++) {
        const enhancement = result.data.enhanced[i]
        if (enhancement.angle) opportunities[i].angle = enhancement.angle
        if (enhancement.hook) opportunities[i].hook = enhancement.hook
        if (enhancement.reasoning) opportunities[i].reasoning = enhancement.reasoning
      }
    }
  } catch (error) {
    console.error('AI enhancement failed:', error)
    // Continue without AI enhancement
  }
}

// ============================================
// Utility Functions
// ============================================

export async function getOpportunities(filters: {
  industry?: string
  channel?: ViralChannel
  status?: OpportunityStatus
  clientId?: string
  limit?: number
}): Promise<Opportunity[]> {
  const supabase = await createClient()

  let query = supabase
    .from('viral_opportunities')
    .select('*')
    .order('score', { ascending: false })

  if (filters.industry) query = query.eq('industry', filters.industry)
  if (filters.channel) query = query.eq('channel', filters.channel)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query

  if (error) throw error

  return (data || []).map(row => ({
    id: row.id,
    clientId: row.client_id,
    industry: row.industry,
    channel: row.channel as ViralChannel,
    topic: row.topic,
    angle: row.angle,
    hook: row.hook,
    reasoning: row.reasoning,
    score: parseFloat(row.score),
    scoreBreakdown: row.score_breakdown as ScoreBreakdown,
    sourceSignalIds: row.source_signal_ids,
    status: row.status as OpportunityStatus,
    createdAt: row.created_at,
  }))
}

export async function updateOpportunityStatus(
  opportunityId: string,
  status: OpportunityStatus
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('viral_opportunities')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', opportunityId)

  if (error) throw error
}

export async function getOpportunityWithSignals(opportunityId: string): Promise<{
  opportunity: Opportunity
  signals: NormalizedSignal[]
} | null> {
  const supabase = await createClient()

  // Get opportunity
  const { data: oppData } = await supabase
    .from('viral_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single()

  if (!oppData) return null

  // Get linked signals
  const { data: signalsData } = await supabase
    .from('viral_signals')
    .select('*')
    .in('id', oppData.source_signal_ids || [])

  const opportunity: Opportunity = {
    id: oppData.id,
    clientId: oppData.client_id,
    industry: oppData.industry,
    channel: oppData.channel as ViralChannel,
    topic: oppData.topic,
    angle: oppData.angle,
    hook: oppData.hook,
    reasoning: oppData.reasoning,
    score: parseFloat(oppData.score),
    scoreBreakdown: oppData.score_breakdown as ScoreBreakdown,
    sourceSignalIds: oppData.source_signal_ids,
    status: oppData.status as OpportunityStatus,
    createdAt: oppData.created_at,
  }

  const signals: NormalizedSignal[] = (signalsData || []).map(row => ({
    sourceType: row.source_type as ViralSourceType,
    externalId: row.external_id,
    url: row.url,
    title: row.title,
    author: row.author,
    community: row.community,
    createdAtExternal: row.created_at_external ? new Date(row.created_at_external) : undefined,
    metrics: row.metrics as NormalizedSignal['metrics'],
    rawExcerpt: row.raw_excerpt,
    industry: row.industry,
  }))

  return { opportunity, signals }
}
