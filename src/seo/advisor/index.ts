/**
 * LLM SEO Advisor
 *
 * Uses Claude to generate actionable rewrite suggestions based on:
 * - Page content analysis
 * - High-signal keyword opportunities
 * - SEO best practices
 *
 * Output is strict JSON following defined schemas.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  PageContent,
  KeywordOpportunity,
  LLMAdvisorInput,
  LLMAdvisorOutput,
  RewriteSuggestion,
  FAQSuggestion,
  ContentAdvisoryReport,
} from '../types'

interface AdvisorOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  maxSuggestions?: number
}

const DEFAULT_OPTIONS: AdvisorOptions = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
  maxSuggestions: 10,
}

const SYSTEM_PROMPT = `Je bent een ervaren SEO-strateeg die marketeers helpt met concrete content-optimalisaties.

## Jouw rol
- Analyseer pagina-content en Search Console data
- Identificeer concrete verbeterkansen
- Geef praktische, direct toepasbare adviezen
- Focus op impact: wat levert de meeste verbetering op?

## Uitgangspunten
- Schrijf in het Nederlands
- Wees specifiek: geen vage adviezen als "optimaliseer de content"
- Geef concrete voorbeeldteksten waar mogelijk
- Leg uit WAAROM een wijziging werkt (educatief)
- Houd rekening met de bestaande tone of voice van de pagina

## JSON Output
Je output MOET valide JSON zijn volgens het opgegeven schema. Geen markdown, geen extra tekst.`

const USER_PROMPT_TEMPLATE = `Analyseer deze pagina en genereer SEO-optimalisatie adviezen.

## Huidige pagina
URL: {{pageUrl}}
Title: {{title}}
Meta description: {{metaDescription}}
H1: {{h1}}
H2s: {{h2s}}
Woordenaantal: {{wordCount}}

## Belangrijkste content (eerste 2000 tekens)
{{contentPreview}}

## Search Console Insights
Totaal impressies: {{totalImpressions}}
Gemiddelde positie: {{avgPosition}}
Aantal geanalyseerde queries: {{queryCount}}

## High-priority keyword opportunities
{{keywordOpportunities}}

## Opdracht
Genereer concrete optimalisatie-adviezen in JSON formaat:

{
  "suggestions": [
    {
      "id": "unieke-id",
      "type": "title|meta_description|h1|h2|body_section|faq|new_section",
      "location": "Waar in de content (bijv. 'Meta description', 'Eerste paragraaf', 'Nieuwe sectie na H2: ...')",
      "currentContent": "Huidige tekst (indien van toepassing)",
      "suggestedContent": "Voorgestelde nieuwe tekst",
      "targetKeywords": ["keyword1", "keyword2"],
      "reasoning": "Waarom deze wijziging effectief is",
      "expectedImpact": "Verwachte impact op rankings/CTR",
      "priority": "high|medium|low"
    }
  ],
  "faqSuggestions": [
    {
      "question": "Veelgestelde vraag gebaseerd op search queries",
      "answer": "Compact, informatief antwoord",
      "targetKeyword": "gerelateerd keyword",
      "searchIntent": "informational|navigational|transactional"
    }
  ],
  "executiveSummary": "2-3 zinnen samenvatting van de belangrijkste bevindingen en quick wins",
  "topPriorities": ["Prioriteit 1", "Prioriteit 2", "Prioriteit 3"],
  "overallScore": 65
}

## Regels
- Maximaal {{maxSuggestions}} suggestions
- Maximaal 5 FAQ suggestions
- overallScore is 0-100 gebaseerd op huidige SEO-staat
- Focus op de highest-impact opportunities
- Elke suggestion moet direct uitvoerbaar zijn`

/**
 * SEO Advisor using Claude
 */
export class SEOAdvisor {
  private client: Anthropic
  private options: AdvisorOptions

  constructor(options: AdvisorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }

    this.client = new Anthropic({ apiKey })
  }

  /**
   * Generate content advisory report
   */
  async generateAdvice(input: LLMAdvisorInput): Promise<LLMAdvisorOutput> {
    const userPrompt = this.buildUserPrompt(input)

    const response = await this.client.messages.create({
      model: this.options.model!,
      max_tokens: this.options.maxTokens!,
      temperature: this.options.temperature!,
      system: SYSTEM_PROMPT,
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
    let output: LLMAdvisorOutput
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      output = JSON.parse(jsonMatch[0])
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${error}`)
    }

    // Validate and sanitize output
    return this.validateOutput(output)
  }

  /**
   * Build user prompt from input data
   */
  private buildUserPrompt(input: LLMAdvisorInput): string {
    const { pageContent, keywordData, analysisContext } = input

    // Format keyword opportunities
    const keywordOpportunities = keywordData
      .slice(0, 15)
      .map(
        (k) =>
          `- "${k.query}" (${k.metrics.impressions} impressies, pos ${k.metrics.position.toFixed(1)}, ${k.type}): ${k.reasoning}`
      )
      .join('\n')

    // Build prompt from template
    return USER_PROMPT_TEMPLATE
      .replace('{{pageUrl}}', pageContent.url)
      .replace('{{title}}', pageContent.title || '(geen title)')
      .replace('{{metaDescription}}', pageContent.metaDescription || '(geen meta description)')
      .replace('{{h1}}', pageContent.h1.join(', ') || '(geen H1)')
      .replace('{{h2s}}', pageContent.h2.slice(0, 5).join(', ') || '(geen H2s)')
      .replace('{{wordCount}}', pageContent.wordCount.toString())
      .replace('{{contentPreview}}', pageContent.mainText.slice(0, 2000))
      .replace('{{totalImpressions}}', analysisContext.totalImpressions.toString())
      .replace('{{avgPosition}}', analysisContext.averagePosition.toFixed(1))
      .replace('{{queryCount}}', keywordData.length.toString())
      .replace('{{keywordOpportunities}}', keywordOpportunities)
      .replace('{{maxSuggestions}}', this.options.maxSuggestions!.toString())
  }

  /**
   * Validate and sanitize LLM output
   */
  private validateOutput(output: unknown): LLMAdvisorOutput {
    const o = output as Record<string, unknown>

    // Ensure required fields exist
    const suggestions = Array.isArray(o.suggestions) ? o.suggestions : []
    const faqSuggestions = Array.isArray(o.faqSuggestions) ? o.faqSuggestions : []
    const executiveSummary = typeof o.executiveSummary === 'string' ? o.executiveSummary : ''
    const topPriorities = Array.isArray(o.topPriorities) ? o.topPriorities : []
    const overallScore = typeof o.overallScore === 'number' ? Math.min(100, Math.max(0, o.overallScore)) : 50

    // Validate suggestions
    const validSuggestions: RewriteSuggestion[] = suggestions
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s, i) => ({
        id: typeof s.id === 'string' ? s.id : `suggestion-${i + 1}`,
        type: this.validateSuggestionType(s.type),
        location: typeof s.location === 'string' ? s.location : 'Onbekend',
        currentContent: typeof s.currentContent === 'string' ? s.currentContent : undefined,
        suggestedContent: typeof s.suggestedContent === 'string' ? s.suggestedContent : '',
        targetKeywords: Array.isArray(s.targetKeywords) ? s.targetKeywords.filter((k): k is string => typeof k === 'string') : [],
        reasoning: typeof s.reasoning === 'string' ? s.reasoning : '',
        expectedImpact: typeof s.expectedImpact === 'string' ? s.expectedImpact : '',
        priority: this.validatePriority(s.priority),
      }))
      .slice(0, this.options.maxSuggestions!)

    // Validate FAQ suggestions
    const validFaqs: FAQSuggestion[] = faqSuggestions
      .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
      .map((f) => ({
        question: typeof f.question === 'string' ? f.question : '',
        answer: typeof f.answer === 'string' ? f.answer : '',
        targetKeyword: typeof f.targetKeyword === 'string' ? f.targetKeyword : '',
        searchIntent: this.validateSearchIntent(f.searchIntent),
      }))
      .filter((f) => f.question && f.answer)
      .slice(0, 5)

    return {
      suggestions: validSuggestions,
      faqSuggestions: validFaqs,
      executiveSummary,
      topPriorities: topPriorities.filter((p): p is string => typeof p === 'string').slice(0, 5),
      overallScore,
    }
  }

  private validateSuggestionType(type: unknown): RewriteSuggestion['type'] {
    const validTypes = ['title', 'meta_description', 'h1', 'h2', 'body_section', 'faq', 'new_section']
    if (typeof type === 'string' && validTypes.includes(type)) {
      return type as RewriteSuggestion['type']
    }
    return 'body_section'
  }

  private validatePriority(priority: unknown): 'high' | 'medium' | 'low' {
    if (priority === 'high' || priority === 'medium' || priority === 'low') {
      return priority
    }
    return 'medium'
  }

  private validateSearchIntent(intent: unknown): FAQSuggestion['searchIntent'] {
    if (intent === 'informational' || intent === 'navigational' || intent === 'transactional') {
      return intent
    }
    return 'informational'
  }
}

/**
 * Build complete content advisory report
 */
export function buildContentAdvisoryReport(
  pageContent: PageContent,
  keywordData: KeywordOpportunity[],
  llmOutput: LLMAdvisorOutput,
  analysisContext: { totalImpressions: number; averagePosition: number }
): ContentAdvisoryReport {
  // Extract key topics from high-impression keywords
  const keyTopics = keywordData
    .filter((k) => k.priority === 'high' || k.metrics.impressions > 100)
    .slice(0, 5)
    .map((k) => k.query)

  // Get top ranking keywords (best positions)
  const topRanking = [...keywordData]
    .sort((a, b) => a.metrics.position - b.metrics.position)
    .slice(0, 5)
    .map((k) => k.query)

  // Get missing keywords
  const missingKeywords = keywordData
    .filter((k) => k.type === 'keyword_gap')
    .slice(0, 5)
    .map((k) => k.query)

  return {
    pageUrl: pageContent.url,
    generatedAt: new Date(),

    currentState: {
      title: pageContent.title,
      metaDescription: pageContent.metaDescription,
      wordCount: pageContent.wordCount,
      h1Count: pageContent.h1.length,
      h2Count: pageContent.h2.length,
      keyTopics,
    },

    keywordAnalysis: {
      totalQueriesAnalyzed: keywordData.length,
      highPriorityOpportunities: keywordData.filter((k) => k.priority === 'high').length,
      topMissingKeywords: missingKeywords,
      topRankingKeywords: topRanking,
    },

    suggestions: llmOutput.suggestions,
    faqSuggestions: llmOutput.faqSuggestions,
    overallScore: llmOutput.overallScore,
    executiveSummary: llmOutput.executiveSummary,
    topPriorities: llmOutput.topPriorities,
  }
}

export { SEOAdvisor as default }
