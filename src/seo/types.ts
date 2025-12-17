/**
 * SEO Content Advisory Module - Type Definitions
 *
 * Types for page analysis, Search Console data, keyword analysis, and LLM recommendations.
 */

// ============================================================================
// Page Content Types
// ============================================================================

export interface PageContent {
  url: string
  title: string
  metaDescription: string
  canonicalUrl?: string
  h1: string[]
  h2: string[]
  h3: string[]
  mainText: string
  wordCount: number
  language?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  structuredData?: Record<string, unknown>[]
  fetchedAt: Date
}

export interface PageContentExtractionOptions {
  includeStructuredData?: boolean
  maxTextLength?: number
  timeout?: number
}

// ============================================================================
// Search Console Types
// ============================================================================

export interface SearchConsoleQuery {
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number  // Click-through rate as decimal (0.05 = 5%)
  position: number  // Average position in search results
}

export interface SearchConsoleFilters {
  siteUrl: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  pageUrl?: string   // Filter to specific page
  dimensions?: ('query' | 'page' | 'device' | 'country')[]
  rowLimit?: number
  startRow?: number
}

export interface SearchConsoleDataset {
  siteUrl: string
  pageUrl: string
  queries: SearchConsoleQuery[]
  dateRange: {
    start: string
    end: string
  }
  totalClicks: number
  totalImpressions: number
  averagePosition: number
  fetchedAt: Date
}

// ============================================================================
// Keyword Analysis Types
// ============================================================================

export type OpportunityType =
  | 'keyword_gap'           // High impressions but keyword missing from content
  | 'ranking_opportunity'   // Position 8-20, can be improved with optimization
  | 'ctr_mismatch'         // Low CTR despite good position
  | 'intent_mismatch'      // Query intent doesn't match content
  | 'quick_win'            // Position 4-10 with good impressions

export interface KeywordOpportunity {
  query: string
  type: OpportunityType
  priority: 'high' | 'medium' | 'low'
  metrics: {
    impressions: number
    clicks: number
    ctr: number
    position: number
  }
  reasoning: string
  suggestedAction: string
  expectedImpact: string
}

export interface KeywordAnalysisResult {
  pageUrl: string
  totalOpportunities: number
  opportunities: KeywordOpportunity[]
  summary: {
    keywordGaps: number
    rankingOpportunities: number
    ctrIssues: number
    intentMismatches: number
    quickWins: number
  }
  analyzedAt: Date
}

// ============================================================================
// LLM Advisor Types
// ============================================================================

export interface RewriteSuggestion {
  id: string
  type: 'title' | 'meta_description' | 'h1' | 'h2' | 'body_section' | 'faq' | 'new_section'
  location: string  // Where in the content this applies
  currentContent?: string
  suggestedContent: string
  targetKeywords: string[]
  reasoning: string
  expectedImpact: string
  priority: 'high' | 'medium' | 'low'
}

export interface FAQSuggestion {
  question: string
  answer: string
  targetKeyword: string
  searchIntent: 'informational' | 'navigational' | 'transactional'
}

export interface ContentAdvisoryReport {
  pageUrl: string
  generatedAt: Date

  // Page Analysis Summary
  currentState: {
    title: string
    metaDescription: string
    wordCount: number
    h1Count: number
    h2Count: number
    keyTopics: string[]
  }

  // Keyword Analysis Summary
  keywordAnalysis: {
    totalQueriesAnalyzed: number
    highPriorityOpportunities: number
    topMissingKeywords: string[]
    topRankingKeywords: string[]
  }

  // Rewrite Suggestions
  suggestions: RewriteSuggestion[]

  // FAQ Suggestions
  faqSuggestions: FAQSuggestion[]

  // Overall Score and Summary
  overallScore: number  // 0-100
  executiveSummary: string
  topPriorities: string[]
}

// ============================================================================
// LLM Schema Types (for strict JSON output)
// ============================================================================

export interface LLMAdvisorInput {
  pageContent: PageContent
  keywordData: KeywordOpportunity[]
  analysisContext: {
    pageUrl: string
    totalImpressions: number
    averagePosition: number
    topQueries: Array<{
      query: string
      impressions: number
      position: number
    }>
  }
}

export interface LLMAdvisorOutput {
  suggestions: RewriteSuggestion[]
  faqSuggestions: FAQSuggestion[]
  executiveSummary: string
  topPriorities: string[]
  overallScore: number
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SEOModuleConfig {
  // Search Console settings
  searchConsole: {
    siteUrl: string
    dateRangeDays: number  // Default: 28 days
    rowLimit: number       // Default: 1000
  }

  // Filtering thresholds
  thresholds: {
    minImpressions: number      // Default: 50
    minPosition: number         // Default: 8 (position 8+ = opportunity)
    maxPosition: number         // Default: 50
    lowCtrThreshold: number     // Default: 0.02 (2%)
    highImpressionsThreshold: number  // Default: 100
  }

  // LLM settings
  llm: {
    provider: 'anthropic' | 'openai'
    model: string
    maxTokens: number
    temperature: number
  }

  // Output settings
  output: {
    format: 'json' | 'markdown'
    includeDetailedAnalysis: boolean
    maxSuggestions: number
  }
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CLIOptions {
  url: string
  siteUrl?: string           // Search Console site URL (defaults from config)
  impressionsMin?: number    // Minimum impressions filter
  positionMin?: number       // Minimum position filter (lower positions are better)
  positionMax?: number       // Maximum position filter
  outputFormat?: 'json' | 'markdown'
  outputFile?: string        // Optional file path to write output
  dryRun?: boolean          // Skip LLM call, just show analysis
  verbose?: boolean
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SEOAnalysisResponse {
  success: boolean
  data?: ContentAdvisoryReport
  error?: string
  timing?: {
    pageFetch: number
    searchConsole: number
    analysis: number
    llm: number
    total: number
  }
}
