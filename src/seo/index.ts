/**
 * SEO Content Advisory Module
 *
 * Main orchestrator that combines:
 * - Page content analysis
 * - Search Console data retrieval
 * - Keyword gap detection
 * - LLM-powered recommendations
 *
 * Usage:
 *   const advisor = new SEOContentAdvisor()
 *   const report = await advisor.analyze('https://example.com/page')
 */

import { analyzePageContent } from './page-analyzer'
import { SearchConsoleClient } from './search-console'
import { analyzeKeywords, getHighSignalKeywords, filterOpportunities } from './keyword-analyzer'
import { SEOAdvisor, buildContentAdvisoryReport } from './advisor'
import type {
  PageContent,
  SearchConsoleDataset,
  KeywordAnalysisResult,
  ContentAdvisoryReport,
  SEOModuleConfig,
  SEOAnalysisResponse,
  CLIOptions,
} from './types'

export * from './types'
export { analyzePageContent } from './page-analyzer'
export { SearchConsoleClient } from './search-console'
export { analyzeKeywords, getHighSignalKeywords, filterOpportunities } from './keyword-analyzer'
export { SEOAdvisor, buildContentAdvisoryReport } from './advisor'

const DEFAULT_CONFIG: SEOModuleConfig = {
  searchConsole: {
    siteUrl: '',
    dateRangeDays: 28,
    rowLimit: 1000,
  },
  thresholds: {
    minImpressions: 50,
    minPosition: 4,
    maxPosition: 50,
    lowCtrThreshold: 0.02,
    highImpressionsThreshold: 100,
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.3,
  },
  output: {
    format: 'json',
    includeDetailedAnalysis: true,
    maxSuggestions: 10,
  },
}

/**
 * Main SEO Content Advisor
 */
export class SEOContentAdvisor {
  private config: SEOModuleConfig
  private searchConsoleClient: SearchConsoleClient | null = null
  private llmAdvisor: SEOAdvisor | null = null

  constructor(config: Partial<SEOModuleConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config)
  }

  /**
   * Analyze a page and generate content advisory report
   */
  async analyze(url: string, options: Partial<CLIOptions> = {}): Promise<SEOAnalysisResponse> {
    const timing = {
      pageFetch: 0,
      searchConsole: 0,
      analysis: 0,
      llm: 0,
      total: 0,
    }

    const totalStart = Date.now()

    try {
      // Step 1: Fetch and analyze page content
      console.log(`\n🔍 Fetching page content: ${url}`)
      const pageFetchStart = Date.now()
      const pageContent = await analyzePageContent(url)
      timing.pageFetch = Date.now() - pageFetchStart
      console.log(`   ✓ Title: ${pageContent.title.slice(0, 60)}...`)
      console.log(`   ✓ Word count: ${pageContent.wordCount}`)
      console.log(`   ✓ H1s: ${pageContent.h1.length}, H2s: ${pageContent.h2.length}`)

      // Step 2: Fetch Search Console data
      const siteUrl = options.siteUrl || this.config.searchConsole.siteUrl
      if (!siteUrl) {
        throw new Error('Search Console site URL is required. Use --site-url or configure in settings.')
      }

      console.log(`\n📊 Fetching Search Console data...`)
      const scStart = Date.now()
      const scClient = this.getSearchConsoleClient()
      const searchData = await scClient.getPageData(siteUrl, url, {
        dateRangeDays: this.config.searchConsole.dateRangeDays,
        rowLimit: this.config.searchConsole.rowLimit,
      })
      timing.searchConsole = Date.now() - scStart
      console.log(`   ✓ Found ${searchData.queries.length} queries`)
      console.log(`   ✓ Total impressions: ${searchData.totalImpressions}`)
      console.log(`   ✓ Average position: ${searchData.averagePosition}`)

      // Step 3: Analyze keywords
      console.log(`\n🎯 Analyzing keyword opportunities...`)
      const analysisStart = Date.now()

      // Apply CLI filters
      const filteredThresholds = {
        ...this.config.thresholds,
        minImpressions: options.impressionsMin ?? this.config.thresholds.minImpressions,
        minPosition: options.positionMin ?? this.config.thresholds.minPosition,
        maxPosition: options.positionMax ?? this.config.thresholds.maxPosition,
      }

      const keywordAnalysis = analyzeKeywords(pageContent, searchData.queries, filteredThresholds)
      timing.analysis = Date.now() - analysisStart

      console.log(`   ✓ Total opportunities: ${keywordAnalysis.totalOpportunities}`)
      console.log(`   ✓ Quick wins: ${keywordAnalysis.summary.quickWins}`)
      console.log(`   ✓ Keyword gaps: ${keywordAnalysis.summary.keywordGaps}`)
      console.log(`   ✓ Ranking opportunities: ${keywordAnalysis.summary.rankingOpportunities}`)

      // Step 4: Skip LLM if dry run
      if (options.dryRun) {
        timing.total = Date.now() - totalStart
        console.log(`\n⏭️  Dry run - skipping LLM analysis`)

        return {
          success: true,
          data: {
            pageUrl: url,
            generatedAt: new Date(),
            currentState: {
              title: pageContent.title,
              metaDescription: pageContent.metaDescription,
              wordCount: pageContent.wordCount,
              h1Count: pageContent.h1.length,
              h2Count: pageContent.h2.length,
              keyTopics: [],
            },
            keywordAnalysis: {
              totalQueriesAnalyzed: keywordAnalysis.opportunities.length,
              highPriorityOpportunities: keywordAnalysis.opportunities.filter((k) => k.priority === 'high').length,
              topMissingKeywords: keywordAnalysis.opportunities
                .filter((k) => k.type === 'keyword_gap')
                .slice(0, 5)
                .map((k) => k.query),
              topRankingKeywords: [...keywordAnalysis.opportunities]
                .sort((a, b) => a.metrics.position - b.metrics.position)
                .slice(0, 5)
                .map((k) => k.query),
            },
            suggestions: [],
            faqSuggestions: [],
            overallScore: 0,
            executiveSummary: '(Dry run - geen LLM analyse uitgevoerd)',
            topPriorities: [],
          },
          timing,
        }
      }

      // Step 5: Generate LLM recommendations
      console.log(`\n🤖 Generating AI recommendations...`)
      const llmStart = Date.now()

      const highSignalKeywords = getHighSignalKeywords(keywordAnalysis, 20)
      const llmAdvisor = this.getLLMAdvisor()

      const llmOutput = await llmAdvisor.generateAdvice({
        pageContent,
        keywordData: highSignalKeywords,
        analysisContext: {
          pageUrl: url,
          totalImpressions: searchData.totalImpressions,
          averagePosition: searchData.averagePosition,
          topQueries: searchData.queries.slice(0, 10).map((q) => ({
            query: q.query,
            impressions: q.impressions,
            position: q.position,
          })),
        },
      })

      timing.llm = Date.now() - llmStart
      timing.total = Date.now() - totalStart

      console.log(`   ✓ Generated ${llmOutput.suggestions.length} suggestions`)
      console.log(`   ✓ Generated ${llmOutput.faqSuggestions.length} FAQ suggestions`)
      console.log(`   ✓ Overall score: ${llmOutput.overallScore}/100`)

      // Build final report
      const report = buildContentAdvisoryReport(
        pageContent,
        highSignalKeywords,
        llmOutput,
        {
          totalImpressions: searchData.totalImpressions,
          averagePosition: searchData.averagePosition,
        }
      )

      return {
        success: true,
        data: report,
        timing,
      }
    } catch (error) {
      timing.total = Date.now() - totalStart
      const message = error instanceof Error ? error.message : String(error)
      console.error(`\n❌ Error: ${message}`)

      return {
        success: false,
        error: message,
        timing,
      }
    }
  }

  /**
   * Get or create Search Console client
   */
  private getSearchConsoleClient(): SearchConsoleClient {
    if (!this.searchConsoleClient) {
      this.searchConsoleClient = SearchConsoleClient.fromEnv()
    }
    return this.searchConsoleClient
  }

  /**
   * Get or create LLM advisor
   */
  private getLLMAdvisor(): SEOAdvisor {
    if (!this.llmAdvisor) {
      this.llmAdvisor = new SEOAdvisor({
        model: this.config.llm.model,
        maxTokens: this.config.llm.maxTokens,
        temperature: this.config.llm.temperature,
        maxSuggestions: this.config.output.maxSuggestions,
      })
    }
    return this.llmAdvisor
  }

  /**
   * Deep merge configuration
   */
  private mergeConfig(
    defaults: SEOModuleConfig,
    overrides: Partial<SEOModuleConfig>
  ): SEOModuleConfig {
    return {
      searchConsole: { ...defaults.searchConsole, ...overrides.searchConsole },
      thresholds: { ...defaults.thresholds, ...overrides.thresholds },
      llm: { ...defaults.llm, ...overrides.llm },
      output: { ...defaults.output, ...overrides.output },
    }
  }
}

/**
 * Format report as Markdown
 */
export function formatReportAsMarkdown(report: ContentAdvisoryReport): string {
  const lines: string[] = []

  lines.push(`# SEO Content Advisory Report`)
  lines.push(``)
  lines.push(`**URL:** ${report.pageUrl}`)
  lines.push(`**Gegenereerd:** ${report.generatedAt.toLocaleString('nl-NL')}`)
  lines.push(`**Overall Score:** ${report.overallScore}/100`)
  lines.push(``)

  // Executive Summary
  lines.push(`## 📋 Samenvatting`)
  lines.push(``)
  lines.push(report.executiveSummary)
  lines.push(``)

  // Top Priorities
  if (report.topPriorities.length > 0) {
    lines.push(`### Top Prioriteiten`)
    report.topPriorities.forEach((p, i) => {
      lines.push(`${i + 1}. ${p}`)
    })
    lines.push(``)
  }

  // Current State
  lines.push(`## 📊 Huidige Staat`)
  lines.push(``)
  lines.push(`| Aspect | Waarde |`)
  lines.push(`|--------|--------|`)
  lines.push(`| Title | ${report.currentState.title || '(ontbreekt)'} |`)
  lines.push(`| Meta Description | ${report.currentState.metaDescription.slice(0, 80) || '(ontbreekt)'}... |`)
  lines.push(`| Woordenaantal | ${report.currentState.wordCount} |`)
  lines.push(`| H1 tags | ${report.currentState.h1Count} |`)
  lines.push(`| H2 tags | ${report.currentState.h2Count} |`)
  lines.push(``)

  // Keyword Analysis
  lines.push(`## 🔑 Keyword Analyse`)
  lines.push(``)
  lines.push(`- **Geanalyseerde queries:** ${report.keywordAnalysis.totalQueriesAnalyzed}`)
  lines.push(`- **High-priority opportunities:** ${report.keywordAnalysis.highPriorityOpportunities}`)
  lines.push(``)

  if (report.keywordAnalysis.topMissingKeywords.length > 0) {
    lines.push(`### Ontbrekende Keywords`)
    report.keywordAnalysis.topMissingKeywords.forEach((k) => {
      lines.push(`- ${k}`)
    })
    lines.push(``)
  }

  if (report.keywordAnalysis.topRankingKeywords.length > 0) {
    lines.push(`### Beste Rankings`)
    report.keywordAnalysis.topRankingKeywords.forEach((k) => {
      lines.push(`- ${k}`)
    })
    lines.push(``)
  }

  // Suggestions
  lines.push(`## ✨ Optimalisatie Suggesties`)
  lines.push(``)

  const highPriority = report.suggestions.filter((s) => s.priority === 'high')
  const mediumPriority = report.suggestions.filter((s) => s.priority === 'medium')
  const lowPriority = report.suggestions.filter((s) => s.priority === 'low')

  if (highPriority.length > 0) {
    lines.push(`### 🔴 Hoge Prioriteit`)
    lines.push(``)
    highPriority.forEach((s) => {
      lines.push(formatSuggestion(s))
    })
  }

  if (mediumPriority.length > 0) {
    lines.push(`### 🟡 Medium Prioriteit`)
    lines.push(``)
    mediumPriority.forEach((s) => {
      lines.push(formatSuggestion(s))
    })
  }

  if (lowPriority.length > 0) {
    lines.push(`### 🟢 Lage Prioriteit`)
    lines.push(``)
    lowPriority.forEach((s) => {
      lines.push(formatSuggestion(s))
    })
  }

  // FAQ Suggestions
  if (report.faqSuggestions.length > 0) {
    lines.push(`## ❓ Voorgestelde FAQs`)
    lines.push(``)
    report.faqSuggestions.forEach((faq, i) => {
      lines.push(`### ${i + 1}. ${faq.question}`)
      lines.push(``)
      lines.push(faq.answer)
      lines.push(``)
      lines.push(`*Target keyword: ${faq.targetKeyword} | Intent: ${faq.searchIntent}*`)
      lines.push(``)
    })
  }

  return lines.join('\n')
}

function formatSuggestion(s: {
  type: string
  location: string
  currentContent?: string
  suggestedContent: string
  targetKeywords: string[]
  reasoning: string
  expectedImpact: string
}): string {
  const lines: string[] = []

  lines.push(`#### ${s.type.replace('_', ' ').toUpperCase()}: ${s.location}`)
  lines.push(``)

  if (s.currentContent) {
    lines.push(`**Huidige tekst:**`)
    lines.push(`> ${s.currentContent}`)
    lines.push(``)
  }

  lines.push(`**Voorgestelde tekst:**`)
  lines.push(`> ${s.suggestedContent}`)
  lines.push(``)

  lines.push(`**Target keywords:** ${s.targetKeywords.join(', ')}`)
  lines.push(``)
  lines.push(`**Waarom:** ${s.reasoning}`)
  lines.push(``)
  lines.push(`**Verwachte impact:** ${s.expectedImpact}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  return lines.join('\n')
}

export default SEOContentAdvisor
