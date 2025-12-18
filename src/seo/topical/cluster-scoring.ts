/**
 * Cluster Scoring Logic
 *
 * Deterministic pre-LLM scoring to calculate cluster maturity.
 * This score is sent to Claude to guide the analysis.
 */

import type { MaturityStage, ClusterMetrics, ClusterQueryData, ClusterUrlData } from './cluster-types'

/**
 * Input for maturity score calculation
 */
export interface MaturityScoreInput {
  totalQueries: number
  avgPosition: number
  top10Share: number // Percentage of queries in top 10
  top3Share: number // Percentage of queries in top 3
  ctr: number // Average CTR as decimal (0.05 = 5%)
  urlCount: number
  queryUrlRatio: number // Queries per URL
  impressionConcentration: number // How concentrated impressions are (0-1, lower = more spread)
}

/**
 * Calculate maturity score (0-100)
 *
 * Scoring breakdown:
 * - Query volume: max 20 points
 * - Ranking positions: max 25 points
 * - CTR performance: max 20 points
 * - URL coverage: max 15 points
 * - Content depth: max 20 points
 */
export function calculateMaturityScore(input: MaturityScoreInput): number {
  let score = 0

  // 1. Query volume (max 20 points)
  // Scale: 0-10 queries = 0-5, 10-50 = 5-15, 50-100 = 15-18, 100+ = 18-20
  if (input.totalQueries <= 10) {
    score += (input.totalQueries / 10) * 5
  } else if (input.totalQueries <= 50) {
    score += 5 + ((input.totalQueries - 10) / 40) * 10
  } else if (input.totalQueries <= 100) {
    score += 15 + ((input.totalQueries - 50) / 50) * 3
  } else {
    score += 18 + Math.min(2, (input.totalQueries - 100) / 100)
  }

  // 2. Ranking positions (max 25 points)
  // Lower avgPosition = better
  // Position 1-3 = 25 pts, 4-10 = 15-25 pts, 11-20 = 5-15 pts, 20+ = 0-5 pts
  if (input.avgPosition <= 3) {
    score += 25
  } else if (input.avgPosition <= 10) {
    score += 25 - ((input.avgPosition - 3) / 7) * 10
  } else if (input.avgPosition <= 20) {
    score += 15 - ((input.avgPosition - 10) / 10) * 10
  } else {
    score += Math.max(0, 5 - (input.avgPosition - 20) / 10)
  }

  // Add bonus for top 3 and top 10 share
  score += input.top3Share * 10 // Bonus up to 10 points for top 3 presence
  score += input.top10Share * 5 // Bonus up to 5 points for top 10 presence

  // Cap position score at 25
  score = Math.min(score, 45) // Cap at 20 (volume) + 25 (position with bonus)

  // 3. CTR performance (max 20 points)
  // Good CTR varies by position, but generally:
  // >5% = excellent, 3-5% = good, 1-3% = average, <1% = poor
  const ctrPercent = input.ctr * 100
  if (ctrPercent >= 5) {
    score += 20
  } else if (ctrPercent >= 3) {
    score += 15 + ((ctrPercent - 3) / 2) * 5
  } else if (ctrPercent >= 1) {
    score += 8 + ((ctrPercent - 1) / 2) * 7
  } else {
    score += ctrPercent * 8
  }

  // 4. URL coverage (max 15 points)
  // Having multiple URLs covering the topic = better authority
  // 1 URL = 3pts, 2-3 = 6pts, 4-6 = 10pts, 7-10 = 13pts, 10+ = 15pts
  if (input.urlCount >= 10) {
    score += 15
  } else if (input.urlCount >= 7) {
    score += 13
  } else if (input.urlCount >= 4) {
    score += 10
  } else if (input.urlCount >= 2) {
    score += 6
  } else {
    score += 3
  }

  // 5. Content depth - query/URL ratio (max 20 points)
  // Healthy ratio is 5-15 queries per URL
  // Too low = thin content, too high = cannibalization risk
  const ratio = input.queryUrlRatio
  if (ratio >= 5 && ratio <= 15) {
    score += 20
  } else if (ratio >= 3 && ratio < 5) {
    score += 10 + ((ratio - 3) / 2) * 10
  } else if (ratio > 15 && ratio <= 25) {
    score += 20 - ((ratio - 15) / 10) * 10
  } else if (ratio < 3) {
    score += ratio * 3.33
  } else {
    score += Math.max(0, 10 - (ratio - 25) / 5)
  }

  return Math.min(100, Math.round(score))
}

/**
 * Determine maturity stage from score
 */
export function getMaturityStage(score: number): MaturityStage {
  if (score >= 75) return 'dominant'
  if (score >= 50) return 'established'
  if (score >= 25) return 'developing'
  return 'emerging'
}

/**
 * Calculate metrics from raw data
 */
export function calculateClusterMetrics(
  queries: ClusterQueryData[],
  urls: ClusterUrlData[]
): ClusterMetrics {
  if (queries.length === 0) {
    return {
      totalQueries: 0,
      totalImpressions: 0,
      totalClicks: 0,
      avgCtr: 0,
      avgPosition: 0,
      top10Queries: 0,
      top3Queries: 0,
      questionQueries: 0,
      buyerQueries: 0,
      urlCount: 0,
      queriesPerUrl: 0,
    }
  }

  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)

  // Weighted average position by impressions
  const weightedPosition = queries.reduce(
    (sum, q) => sum + q.position * q.impressions,
    0
  )

  return {
    totalQueries: queries.length,
    totalImpressions,
    totalClicks,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgPosition: totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
    top10Queries: queries.filter((q) => q.position <= 10).length,
    top3Queries: queries.filter((q) => q.position <= 3).length,
    questionQueries: queries.filter((q) => q.isQuestion).length,
    buyerQueries: queries.filter((q) => q.isBuyerKeyword).length,
    urlCount: urls.length,
    queriesPerUrl: urls.length > 0 ? queries.length / urls.length : 0,
  }
}

/**
 * Build maturity score input from metrics
 */
export function buildMaturityScoreInput(metrics: ClusterMetrics): MaturityScoreInput {
  return {
    totalQueries: metrics.totalQueries,
    avgPosition: metrics.avgPosition,
    top10Share: metrics.totalQueries > 0 ? metrics.top10Queries / metrics.totalQueries : 0,
    top3Share: metrics.totalQueries > 0 ? metrics.top3Queries / metrics.totalQueries : 0,
    ctr: metrics.avgCtr,
    urlCount: metrics.urlCount,
    queryUrlRatio: metrics.queriesPerUrl,
    impressionConcentration: 0.5, // TODO: Calculate from actual distribution
  }
}

/**
 * Detect potential cannibalization issues
 * Returns queries where multiple URLs rank
 */
export function detectCannibalization(
  queries: ClusterQueryData[],
  minImpressions: number = 50
): Array<{
  query: string
  impressions: number
  urlCount: number
  urls: string[]
}> {
  return queries
    .filter((q) => q.rankingUrls.length > 1 && q.impressions >= minImpressions)
    .map((q) => ({
      query: q.query,
      impressions: q.impressions,
      urlCount: q.rankingUrls.length,
      urls: q.rankingUrls,
    }))
    .sort((a, b) => b.impressions - a.impressions)
}

/**
 * Identify potential pillar pages based on query coverage
 */
export function identifyPotentialPillars(
  urls: ClusterUrlData[],
  queries: ClusterQueryData[]
): ClusterUrlData[] {
  // Sort by query count and impressions
  return [...urls]
    .sort((a, b) => {
      // Primary sort: query count
      const queryDiff = b.queryCount - a.queryCount
      if (queryDiff !== 0) return queryDiff
      // Secondary sort: impressions
      return b.impressions - a.impressions
    })
    .slice(0, 3) // Return top 3 potential pillars
}

/**
 * Get query intent distribution
 */
export function getIntentDistribution(queries: ClusterQueryData[]): {
  informational: number
  commercial: number
  transactional: number
} {
  const questionCount = queries.filter((q) => q.isQuestion).length
  const buyerCount = queries.filter((q) => q.isBuyerKeyword).length
  const total = queries.length || 1

  return {
    informational: questionCount / total,
    commercial: Math.max(0, (total - questionCount - buyerCount) / total),
    transactional: buyerCount / total,
  }
}
