/**
 * Topical Cluster Analysis Types
 *
 * Types for cluster-level SEO analysis including maturity scoring,
 * pillar detection, content gaps, and cannibalization issues.
 */

// ============================================================================
// Maturity & Stage Types
// ============================================================================

export type MaturityStage = 'emerging' | 'developing' | 'established' | 'dominant'

export type SearchIntent = 'informational' | 'commercial' | 'transactional'

export type PillarRole = 'primary' | 'secondary'

// ============================================================================
// Input Types (what we send to Claude)
// ============================================================================

export interface ClusterQueryData {
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  rankingUrls: string[]
  isQuestion: boolean
  isBuyerKeyword: boolean
}

export interface ClusterUrlData {
  url: string
  queryCount: number
  impressions: number
  clicks: number
  avgPosition: number
  internalLinksIn?: number
  internalLinksOut?: number
}

export interface ClusterAnalysisInput {
  clusterName: string
  clusterDescription?: string
  totalQueries: number
  totalImpressions: number
  totalClicks: number
  avgPosition: number
  avgCtr: number
  queries: ClusterQueryData[]
  urls: ClusterUrlData[]
  // Pre-calculated maturity score to guide Claude
  calculatedMaturityScore: number
}

// ============================================================================
// Output Types (what Claude returns)
// ============================================================================

export interface TopicalClusterReport {
  clusterName: string
  generatedAt: Date

  // Maturity assessment
  maturity: {
    score: number // 0-100
    stage: MaturityStage
    explanation: string
  }

  // Pillar page identification
  pillars: PillarPage[]

  // Supporting content mapping
  supportingPages: SupportingPage[]

  // Content gaps (new pages needed)
  contentGaps: ContentGap[]

  // Keyword cannibalization issues
  cannibalization: CannibalizationIssue[]

  // Internal linking issues
  internalLinking: InternalLinkingIssue[]

  // Action roadmap
  roadmap: RoadmapItem[]

  // Summary metrics
  metrics: ClusterMetrics
}

export interface PillarPage {
  url: string
  role: PillarRole
  coveredIntents: SearchIntent[]
  topQueries: string[]
  reasoning: string
}

export interface SupportingPage {
  pillarUrl: string
  url: string
  primaryIntent: SearchIntent
  supportingQueries: string[]
}

export interface ContentGap {
  suggestedPageTitle: string
  targetQueries: string[]
  intent: SearchIntent
  reason: string
  suggestedUrl?: string
  priority: 'high' | 'medium' | 'low'
  expectedImpact: string
}

export interface CannibalizationIssue {
  query: string
  impressions: number
  competingUrls: string[]
  currentPositions: number[]
  recommendation: string
  severity: 'high' | 'medium' | 'low'
}

export interface InternalLinkingIssue {
  issue: 'missing_pillar_links' | 'orphan_page' | 'weak_cluster_density' | 'no_supporting_links'
  affectedUrls: string[]
  recommendation: string
  priority: 'high' | 'medium' | 'low'
}

export interface RoadmapItem {
  priority: 'high' | 'medium' | 'low'
  category: 'content_creation' | 'content_optimization' | 'internal_linking' | 'consolidation'
  action: string
  targetUrl?: string
  targetQueries?: string[]
  expectedImpact: string
  effort: 'low' | 'medium' | 'high'
}

export interface ClusterMetrics {
  totalQueries: number
  totalImpressions: number
  totalClicks: number
  avgCtr: number
  avgPosition: number
  top10Queries: number
  top3Queries: number
  questionQueries: number
  buyerQueries: number
  urlCount: number
  queriesPerUrl: number
}

// ============================================================================
// LLM Response Schema (raw Claude output before validation)
// ============================================================================

export interface LLMClusterOutput {
  maturity: {
    score: number
    stage: string
    explanation: string
  }
  pillars: Array<{
    url: string
    role: string
    coveredIntents: string[]
    topQueries: string[]
    reasoning: string
  }>
  supportingPages: Array<{
    pillarUrl: string
    url: string
    primaryIntent: string
    supportingQueries: string[]
  }>
  contentGaps: Array<{
    suggestedPageTitle: string
    targetQueries: string[]
    intent: string
    reason: string
    suggestedUrl?: string
    priority: string
    expectedImpact: string
  }>
  cannibalization: Array<{
    query: string
    impressions: number
    competingUrls: string[]
    currentPositions: number[]
    recommendation: string
    severity: string
  }>
  internalLinking: Array<{
    issue: string
    affectedUrls: string[]
    recommendation: string
    priority: string
  }>
  roadmap: Array<{
    priority: string
    category: string
    action: string
    targetUrl?: string
    targetQueries?: string[]
    expectedImpact: string
    effort: string
  }>
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ClusterAnalysisResponse {
  success: boolean
  data?: TopicalClusterReport
  error?: string
  timing?: {
    dataFetch: number
    scoring: number
    llm: number
    total: number
  }
}

// ============================================================================
// Configuration
// ============================================================================

export interface ClusterAnalysisConfig {
  model?: string
  maxTokens?: number
  temperature?: number
  // Query limits
  maxQueries?: number
  maxUrls?: number
  // Thresholds
  minQueriesForAnalysis?: number
  minImpressionsForQuery?: number
}

export const DEFAULT_CLUSTER_CONFIG: ClusterAnalysisConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.2,
  maxQueries: 100,
  maxUrls: 50,
  minQueriesForAnalysis: 5,
  minImpressionsForQuery: 5,
}
