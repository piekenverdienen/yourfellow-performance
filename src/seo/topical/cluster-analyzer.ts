/**
 * Topical Cluster Analyzer
 *
 * Orchestrates the cluster analysis workflow:
 * 1. Calculate deterministic metrics
 * 2. Build maturity score
 * 3. Call Claude for intelligent analysis
 * 4. Validate and return structured report
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  ClusterAnalysisInput,
  TopicalClusterReport,
  ClusterAnalysisConfig,
  ClusterMetrics,
  LLMClusterOutput,
  MaturityStage,
  SearchIntent,
  PillarRole,
  PillarPage,
  SupportingPage,
  ContentGap,
  CannibalizationIssue,
  InternalLinkingIssue,
  RoadmapItem,
  DEFAULT_CLUSTER_CONFIG,
} from './cluster-types'
import { CLUSTER_SYSTEM_PROMPT, buildClusterUserPrompt } from './cluster-prompts'
import {
  calculateMaturityScore,
  getMaturityStage,
  calculateClusterMetrics,
  buildMaturityScoreInput,
} from './cluster-scoring'

// Re-export types for convenience
export * from './cluster-types'
export { calculateMaturityScore, getMaturityStage, calculateClusterMetrics } from './cluster-scoring'

/**
 * Main Cluster Analyzer class
 */
export class TopicalClusterAnalyzer {
  private client: Anthropic
  private config: Required<ClusterAnalysisConfig>

  constructor(config: ClusterAnalysisConfig = {}) {
    this.config = {
      model: config.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.2,
      maxQueries: config.maxQueries ?? 100,
      maxUrls: config.maxUrls ?? 50,
      minQueriesForAnalysis: config.minQueriesForAnalysis ?? 5,
      minImpressionsForQuery: config.minImpressionsForQuery ?? 5,
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }

    this.client = new Anthropic({ apiKey })
  }

  /**
   * Analyze a topic cluster
   */
  async analyze(input: ClusterAnalysisInput): Promise<TopicalClusterReport> {
    // Filter queries by minimum impressions
    const filteredQueries = input.queries.filter(
      (q) => q.impressions >= this.config.minImpressionsForQuery
    )

    // Check minimum query threshold
    if (filteredQueries.length < this.config.minQueriesForAnalysis) {
      throw new Error(
        `Insufficient queries for analysis. Found ${filteredQueries.length}, minimum ${this.config.minQueriesForAnalysis} required.`
      )
    }

    // Calculate metrics
    const metrics = calculateClusterMetrics(filteredQueries, input.urls)
    const scoreInput = buildMaturityScoreInput(metrics)
    const maturityScore = calculateMaturityScore(scoreInput)

    // Build prompt
    const userPrompt = buildClusterUserPrompt({
      clusterName: input.clusterName,
      clusterDescription: input.clusterDescription,
      totalQueries: metrics.totalQueries,
      totalImpressions: metrics.totalImpressions,
      totalClicks: metrics.totalClicks,
      avgPosition: metrics.avgPosition,
      avgCtr: metrics.avgCtr,
      calculatedMaturityScore: maturityScore,
      queries: filteredQueries.slice(0, this.config.maxQueries),
      urls: input.urls.slice(0, this.config.maxUrls),
    })

    // Call Claude
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: CLUSTER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    let llmOutput: LLMClusterOutput
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      llmOutput = JSON.parse(jsonMatch[0])
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${error}`)
    }

    // Validate and build report
    return this.buildReport(input.clusterName, llmOutput, metrics)
  }

  /**
   * Build and validate the final report
   */
  private buildReport(
    clusterName: string,
    llmOutput: LLMClusterOutput,
    metrics: ClusterMetrics
  ): TopicalClusterReport {
    return {
      clusterName,
      generatedAt: new Date(),
      maturity: this.validateMaturity(llmOutput.maturity),
      pillars: this.validatePillars(llmOutput.pillars),
      supportingPages: this.validateSupportingPages(llmOutput.supportingPages),
      contentGaps: this.validateContentGaps(llmOutput.contentGaps),
      cannibalization: this.validateCannibalization(llmOutput.cannibalization),
      internalLinking: this.validateInternalLinking(llmOutput.internalLinking),
      roadmap: this.validateRoadmap(llmOutput.roadmap),
      metrics,
    }
  }

  private validateMaturity(m: LLMClusterOutput['maturity']): TopicalClusterReport['maturity'] {
    const validStages: MaturityStage[] = ['emerging', 'developing', 'established', 'dominant']
    return {
      score: typeof m?.score === 'number' ? Math.min(100, Math.max(0, m.score)) : 50,
      stage: validStages.includes(m?.stage as MaturityStage)
        ? (m.stage as MaturityStage)
        : 'developing',
      explanation: typeof m?.explanation === 'string' ? m.explanation : '',
    }
  }

  private validatePillars(pillars: LLMClusterOutput['pillars']): PillarPage[] {
    if (!Array.isArray(pillars)) return []

    return pillars
      .filter((p) => typeof p?.url === 'string' && p.url.length > 0)
      .map((p) => ({
        url: p.url,
        role: (p.role === 'primary' || p.role === 'secondary' ? p.role : 'secondary') as PillarRole,
        coveredIntents: this.validateIntents(p.coveredIntents),
        topQueries: Array.isArray(p.topQueries)
          ? p.topQueries.filter((q): q is string => typeof q === 'string').slice(0, 5)
          : [],
        reasoning: typeof p.reasoning === 'string' ? p.reasoning : '',
      }))
      .slice(0, 3)
  }

  private validateSupportingPages(pages: LLMClusterOutput['supportingPages']): SupportingPage[] {
    if (!Array.isArray(pages)) return []

    return pages
      .filter((p) => typeof p?.url === 'string' && typeof p?.pillarUrl === 'string')
      .map((p) => ({
        pillarUrl: p.pillarUrl,
        url: p.url,
        primaryIntent: this.validateIntent(p.primaryIntent),
        supportingQueries: Array.isArray(p.supportingQueries)
          ? p.supportingQueries.filter((q): q is string => typeof q === 'string').slice(0, 5)
          : [],
      }))
  }

  private validateContentGaps(gaps: LLMClusterOutput['contentGaps']): ContentGap[] {
    if (!Array.isArray(gaps)) return []

    return gaps
      .filter((g) => typeof g?.suggestedPageTitle === 'string')
      .map((g) => ({
        suggestedPageTitle: g.suggestedPageTitle,
        targetQueries: Array.isArray(g.targetQueries)
          ? g.targetQueries.filter((q): q is string => typeof q === 'string').slice(0, 5)
          : [],
        intent: this.validateIntent(g.intent),
        reason: typeof g.reason === 'string' ? g.reason : '',
        suggestedUrl: typeof g.suggestedUrl === 'string' ? g.suggestedUrl : undefined,
        priority: this.validatePriority(g.priority),
        expectedImpact: typeof g.expectedImpact === 'string' ? g.expectedImpact : '',
      }))
      .slice(0, 10)
  }

  private validateCannibalization(issues: LLMClusterOutput['cannibalization']): CannibalizationIssue[] {
    if (!Array.isArray(issues)) return []

    return issues
      .filter((i) => typeof i?.query === 'string' && Array.isArray(i?.competingUrls))
      .map((i) => ({
        query: i.query,
        impressions: typeof i.impressions === 'number' ? i.impressions : 0,
        competingUrls: i.competingUrls.filter((u): u is string => typeof u === 'string'),
        currentPositions: Array.isArray(i.currentPositions)
          ? i.currentPositions.filter((p): p is number => typeof p === 'number')
          : [],
        recommendation: typeof i.recommendation === 'string' ? i.recommendation : '',
        severity: this.validateSeverity(i.severity),
      }))
      .slice(0, 10)
  }

  private validateInternalLinking(issues: LLMClusterOutput['internalLinking']): InternalLinkingIssue[] {
    if (!Array.isArray(issues)) return []

    const validIssueTypes = ['missing_pillar_links', 'orphan_page', 'weak_cluster_density', 'no_supporting_links']

    return issues
      .filter(
        (i) =>
          validIssueTypes.includes(i?.issue) &&
          Array.isArray(i?.affectedUrls)
      )
      .map((i) => ({
        issue: i.issue as InternalLinkingIssue['issue'],
        affectedUrls: i.affectedUrls.filter((u): u is string => typeof u === 'string'),
        recommendation: typeof i.recommendation === 'string' ? i.recommendation : '',
        priority: this.validatePriority(i.priority),
      }))
      .slice(0, 10)
  }

  private validateRoadmap(items: LLMClusterOutput['roadmap']): RoadmapItem[] {
    if (!Array.isArray(items)) return []

    const validCategories = ['content_creation', 'content_optimization', 'internal_linking', 'consolidation']

    return items
      .filter((i) => typeof i?.action === 'string')
      .map((i) => ({
        priority: this.validatePriority(i.priority),
        category: validCategories.includes(i.category)
          ? (i.category as RoadmapItem['category'])
          : 'content_optimization',
        action: i.action,
        targetUrl: typeof i.targetUrl === 'string' ? i.targetUrl : undefined,
        targetQueries: Array.isArray(i.targetQueries)
          ? i.targetQueries.filter((q): q is string => typeof q === 'string').slice(0, 5)
          : undefined,
        expectedImpact: typeof i.expectedImpact === 'string' ? i.expectedImpact : '',
        effort: this.validateEffort(i.effort),
      }))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
      .slice(0, 10)
  }

  private validateIntent(intent: unknown): SearchIntent {
    if (intent === 'informational' || intent === 'commercial' || intent === 'transactional') {
      return intent
    }
    return 'informational'
  }

  private validateIntents(intents: unknown): SearchIntent[] {
    if (!Array.isArray(intents)) return ['informational']
    return intents
      .filter(
        (i): i is SearchIntent =>
          i === 'informational' || i === 'commercial' || i === 'transactional'
      )
  }

  private validatePriority(priority: unknown): 'high' | 'medium' | 'low' {
    if (priority === 'high' || priority === 'medium' || priority === 'low') {
      return priority
    }
    return 'medium'
  }

  private validateSeverity(severity: unknown): 'high' | 'medium' | 'low' {
    if (severity === 'high' || severity === 'medium' || severity === 'low') {
      return severity
    }
    return 'medium'
  }

  private validateEffort(effort: unknown): 'low' | 'medium' | 'high' {
    if (effort === 'low' || effort === 'medium' || effort === 'high') {
      return effort
    }
    return 'medium'
  }
}

/**
 * Convenience function for one-off analysis
 */
export async function analyzeTopicalCluster(
  input: ClusterAnalysisInput,
  config?: ClusterAnalysisConfig
): Promise<TopicalClusterReport> {
  const analyzer = new TopicalClusterAnalyzer(config)
  return analyzer.analyze(input)
}
