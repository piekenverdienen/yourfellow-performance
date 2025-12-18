/**
 * Topical Cluster Analysis Module
 *
 * Provides cluster-level SEO analysis using Search Console data.
 *
 * Usage:
 * ```typescript
 * import { TopicalClusterAnalyzer, analyzeTopicalCluster } from '@/seo/topical'
 *
 * // Using the class
 * const analyzer = new TopicalClusterAnalyzer()
 * const report = await analyzer.analyze(clusterInput)
 *
 * // Using the convenience function
 * const report = await analyzeTopicalCluster(clusterInput)
 * ```
 */

// Main analyzer
export { TopicalClusterAnalyzer, analyzeTopicalCluster } from './cluster-analyzer'

// Types
export type {
  // Input types
  ClusterAnalysisInput,
  ClusterQueryData,
  ClusterUrlData,
  ClusterAnalysisConfig,
  // Output types
  TopicalClusterReport,
  ClusterMetrics,
  PillarPage,
  SupportingPage,
  ContentGap,
  CannibalizationIssue,
  InternalLinkingIssue,
  RoadmapItem,
  // Enum types
  MaturityStage,
  SearchIntent,
  PillarRole,
  // API types
  ClusterAnalysisResponse,
} from './cluster-types'

// Scoring utilities
export {
  calculateMaturityScore,
  getMaturityStage,
  calculateClusterMetrics,
  buildMaturityScoreInput,
  detectCannibalization,
  identifyPotentialPillars,
  getIntentDistribution,
} from './cluster-scoring'

// Prompts (for customization)
export {
  CLUSTER_SYSTEM_PROMPT,
  CLUSTER_USER_PROMPT_TEMPLATE,
  buildClusterUserPrompt,
} from './cluster-prompts'
