/**
 * AI Gateway Service - MVP Version
 *
 * Minimal viable gateway for AI operations.
 * Focus: simple flow, one provider, basic logging.
 *
 * Flow: Request → Model Selection → Template → Provider → Response + Logging
 *
 * MVP SCOPE:
 * ✓ Text generation only
 * ✓ Anthropic provider (primary)
 * ✓ Hardcoded fallback templates
 * ✓ Client context injection
 * ✓ Basic usage logging (existing 'usage' table)
 *
 * ROADMAP (not implemented):
 * - Multi-provider fallback (see providers/)
 * - Database templates with versioning (see supabase-ai-gateway.sql)
 * - A/B testing
 * - Evaluations (see evaluator.ts)
 * - Image generation
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getModelForTask, calculateCost } from './models'
import type {
  AIGenerateRequest,
  AIResult,
  AITask,
  AIClientContext,
} from './types'

// ============================================
// Simple Template Type (MVP)
// ============================================

interface SimpleTemplate {
  id: string
  task: AITask
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens: number
  xpReward: number
}

// ============================================
// Hardcoded Templates (MVP)
// ============================================
// Later: move to database via supabase-ai-gateway.sql

const TEMPLATES: Record<string, SimpleTemplate> = {
  google_ads_copy: {
    id: 'google-ads-copy-v1',
    task: 'google_ads_copy',
    systemPrompt: `Je bent een ervaren Google Ads copywriter gespecialiseerd in het schrijven van advertenties met hoge Quality Scores.

TECHNISCHE EISEN:
- Headlines: STRIKT max 30 karakters (inclusief spaties)
- Descriptions: STRIKT max 90 karakters (inclusief spaties)
- Tel karakters nauwkeurig! Overschrijd NOOIT de limieten.

SCHRIJFREGELS:
- Gebruik actieve, directe taal
- Vermijd generieke zinnen zoals "Bestel nu" of "Klik hier"
- Verwerk keywords natuurlijk in de tekst
- Gebruik cijfers en specifieke voordelen waar mogelijk
- Creëer urgentie zonder clickbait te zijn
- Pas de tone of voice aan op de doelgroep

QUALITY SCORE OPTIMALISATIE:
- Als er landingspagina content is meegegeven: gebruik EXACT dezelfde woorden en termen
- Dit verhoogt de Ad Relevance en Landing Page Experience scores

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug in dit formaat (geen markdown codeblocks):
{
  "headlines": ["headline1", "headline2", ...],
  "descriptions": ["description1", "description2", ...]
}

Genereer minimaal 15 unieke headlines en 4 unieke descriptions.`,
    userPromptTemplate: `Product: {{product_name}}
Beschrijving: {{product_description}}
Doelgroep: {{target_audience}}
Keywords: {{keywords}}
Tone: {{tone}}
{{landing_page_content}}`,
    temperature: 0.7,
    maxTokens: 2048,
    xpReward: 10,
  },

  image_prompt: {
    id: 'image-prompt-v1',
    task: 'image_prompt',
    systemPrompt: `Je bent een expert image prompt engineer. Je analyseert social media posts en schrijft visueel beschrijvende prompts voor AI image generators.

REGELS:
- Schrijf ALLEEN de image prompt, geen uitleg
- Prompt moet in het ENGELS zijn
- NOOIT tekst, woorden, letters of logo's beschrijven (AI kan dit niet)
- Beschrijf: onderwerp, setting, belichting, stijl, kleuren, compositie, sfeer
- Gebruik beschrijvende bijvoeglijke naamwoorden
- Max 80 woorden`,
    userPromptTemplate: `Platform: {{platform}}
Post inhoud: {{content}}`,
    temperature: 0.8,
    maxTokens: 500,
    xpReward: 5,
  },

  social_post: {
    id: 'social-post-v1',
    task: 'social_post',
    systemPrompt: `Je bent een social media expert die engaging posts schrijft voor diverse platformen.

PLATFORM STIJLEN:
- LinkedIn: Professioneel, thought leadership, langere tekst toegestaan, geen hashtag-spam
- Instagram: Visueel, storytelling, emoji's welkom, relevante hashtags
- Facebook: Conversational, community-gericht, persoonlijk
- Twitter/X: Kort, puntig, max 280 karakters, trending topics

SCHRIJFREGELS:
- Schrijf in het Nederlands tenzij anders gevraagd
- Pas toon aan op platform én doelgroep
- Begin met een hook die aandacht trekt
- Eindig met een duidelijke call-to-action
- Hashtags: relevant en niet overdreven (max 5 voor Instagram, max 3 voor LinkedIn)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "primary_text": "De hoofdtekst van de post",
  "headline": "Optionele headline (vooral voor LinkedIn)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "suggested_cta": "Voorgestelde call-to-action"
}`,
    userPromptTemplate: `Platform: {{platform}}
Onderwerp: {{topic}}
Context: {{context}}
Doelgroep: {{target_audience}}
Tone of voice: {{tone}}
Type post: {{post_type}}`,
    temperature: 0.8,
    maxTokens: 1024,
    xpReward: 8,
  },

  seo_content: {
    id: 'seo-content-v1',
    task: 'seo_content',
    systemPrompt: `Je bent een SEO content specialist die informatieve, goed leesbare content schrijft die rankt in Google.

SEO PRINCIPES:
- Verwerk het primair keyword in de titel en eerste alinea
- Gebruik secundaire keywords natuurlijk door de tekst
- Keyword dichtheid: 1-2% (niet meer, niet minder)
- Gebruik H2 en H3 headers met relevante keywords
- Schrijf korte alinea's (max 3-4 zinnen)
- Gebruik bullet points waar relevant

STRUCTUUR:
- Start met een sterke introductie die de lezer pakt
- Gebruik duidelijke tussenkoppen (## en ###)
- Eindig met een conclusie en call-to-action

LENGTE RICHTLIJNEN:
- short: 300-500 woorden
- medium: 500-800 woorden
- long: 800-1200 woorden
- comprehensive: 1200+ woorden

OUTPUT:
Schrijf de content in Markdown formaat met headers. Geen JSON.`,
    userPromptTemplate: `Onderwerp: {{topic}}
Primair keyword: {{primary_keyword}}
Secundaire keywords: {{secondary_keywords}}
Doelgroep: {{target_audience}}
Type content: {{content_type}}
Gewenste lengte: {{length}}
Tone of voice: {{tone}}`,
    temperature: 0.7,
    maxTokens: 4096,
    xpReward: 15,
  },

  seo_meta: {
    id: 'seo-meta-v1',
    task: 'seo_meta',
    systemPrompt: `Je bent een SEO specialist die geoptimaliseerde meta tags schrijft voor betere CTR in zoekresultaten.

TECHNISCHE EISEN:
- Title tag: 50-60 karakters (inclusief spaties)
- Meta description: 150-160 karakters (inclusief spaties)
- Tel karakters nauwkeurig!

SCHRIJFREGELS:
- Verwerk het primair keyword vooraan in de title
- Maak de description een compelling samenvatting
- Gebruik actieve taal die aanzet tot klikken
- Voeg merkNaam toe aan title indien opgegeven (bijv. "... | MerkNaam")
- OG tags mogen iets langer/anders zijn dan reguliere meta tags

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "title": "De title tag (50-60 karakters)",
  "description": "De meta description (150-160 karakters)",
  "og_title": "Open Graph title",
  "og_description": "Open Graph description"
}`,
    userPromptTemplate: `URL: {{page_url}}
Pagina inhoud: {{page_content}}
Primair keyword: {{primary_keyword}}
Merknaam: {{brand_name}}
Type pagina: {{page_type}}`,
    temperature: 0.6,
    maxTokens: 512,
    xpReward: 5,
  },

  cro_analysis: {
    id: 'cro-analysis-v1',
    task: 'cro_analysis',
    systemPrompt: `Je bent een CRO (Conversion Rate Optimization) expert die landingspaginas analyseert op basis van Cialdini's 6 overtuigingsprincipes.

DE 6 PRINCIPES:
1. Wederkerigheid - Geef iets waardevols (gratis content, proefperiode)
2. Schaarste - Creëer urgentie (beperkte tijd, beperkte voorraad)
3. Autoriteit - Toon expertise (certificaten, awards, media mentions)
4. Consistentie - Kleine commitments leiden tot grotere (micro-conversies)
5. Sympathie - Wees relatable (team foto's, persoonlijke verhalen)
6. Sociale bewijskracht - Reviews, testimonials, aantal klanten

ANALYSE INSTRUCTIES:
- Score elk principe van 0-10
- Identificeer concrete elementen die je vindt
- Geef specifieke, actionable verbeterpunten
- Bereken een overall score (gemiddelde)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "overall_score": 7.5,
  "principles": [
    {
      "name": "Wederkerigheid",
      "score": 8,
      "found_elements": ["Gratis e-book aangeboden", "Gratis consultatie"],
      "suggestions": ["Voeg een gratis tool toe", "Bied een checklist aan"]
    }
  ],
  "top_improvements": [
    "Voeg meer sociale bewijskracht toe met reviews",
    "Creëer urgentie met een tijdelijke aanbieding"
  ]
}`,
    userPromptTemplate: `URL: {{url}}
Type pagina: {{page_type}}

Pagina inhoud:
{{page_content}}`,
    temperature: 0.5,
    maxTokens: 2048,
    xpReward: 12,
  },
}

// ============================================
// Main Gateway Class (MVP)
// ============================================

export class AIGateway {
  private anthropic: Anthropic

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * Generate text using AI
   *
   * Simple flow:
   * 1. Get model for task
   * 2. Get template
   * 3. Build prompts (+ client context)
   * 4. Call Anthropic
   * 5. Log usage
   * 6. Return result
   */
  async generateText<T = string>(request: AIGenerateRequest): Promise<AIResult<T>> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    try {
      // 1. Get model configuration
      const model = getModelForTask(request.task)

      // 2. Get template (hardcoded for MVP)
      const template = TEMPLATES[request.task]
      if (!template) {
        return this.errorResult(`No template for task: ${request.task}`, requestId, startTime)
      }

      // 3. Build prompts
      let systemPrompt = template.systemPrompt
      const userPrompt = this.renderTemplate(template.userPromptTemplate, request.input)

      // 4. Add client context if provided
      if (request.clientId) {
        const clientContext = await this.getClientContext(request.clientId)
        if (clientContext) {
          systemPrompt = this.injectClientContext(systemPrompt, clientContext)
        }
      }

      // 5. Call Anthropic
      const response = await this.anthropic.messages.create({
        model: model.modelName,
        max_tokens: request.options?.maxTokens || template.maxTokens,
        temperature: request.options?.temperature ?? template.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      // Extract content
      const textContent = response.content.find(block => block.type === 'text')
      let content = textContent ? textContent.text : ''

      // Strip markdown code blocks if present
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const inputTokens = response.usage?.input_tokens || 0
      const outputTokens = response.usage?.output_tokens || 0
      const durationMs = Date.now() - startTime
      const estimatedCost = calculateCost(model.id, inputTokens, outputTokens)

      // 6. Log usage (fire and forget)
      if (!request.options?.skipLogging && request.options?.userId) {
        this.logUsage(
          request.options.userId,
          request.task,
          inputTokens,
          outputTokens,
          template.xpReward,
          request.clientId
        ).catch(console.error)
      }

      // 7. Parse JSON if needed
      let data: T
      try {
        data = JSON.parse(content) as T
      } catch {
        data = content as unknown as T
      }

      return {
        success: true,
        data,
        usage: {
          modelId: model.id,
          provider: model.provider,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost,
          durationMs,
        },
        metadata: {
          templateId: template.id,
          templateVersion: '1.0.0',
          clientId: request.clientId,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error('AI Gateway error:', error)
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        requestId,
        startTime
      )
    }
  }

  // ============================================
  // Template Rendering
  // ============================================

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = variables[key]
      if (value === undefined || value === null) return ''
      if (Array.isArray(value)) return value.join(', ')
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    })
  }

  // ============================================
  // Client Context
  // ============================================

  /**
   * Fetch client context from database
   * Uses existing clients table and settings.context
   */
  private async getClientContext(clientId: string): Promise<AIClientContext | null> {
    try {
      const supabase = await createClient()

      // Verify access
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

      if (!hasAccess) return null

      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (!client?.settings?.context) return null

      const ctx = client.settings.context as Record<string, unknown>

      return {
        clientId,
        clientName: client.name,
        brandVoice: (ctx.brandVoice as string) || '',
        toneOfVoice: (ctx.toneOfVoice as string) || '',
        proposition: (ctx.proposition as string) || '',
        targetAudience: (ctx.targetAudience as string) || '',
        usps: (ctx.usps as string[]) || [],
        bestsellers: ctx.bestsellers as string[] | undefined,
        seasonality: ctx.seasonality as string[] | undefined,
        margins: ctx.margins as { min: number; target: number } | undefined,
        doNotUse: (ctx.doNots as string[]) || [],
        mustHave: (ctx.mustHaves as string[]) || [],
        activeChannels: (ctx.activeChannels as string[]) || [],
      }
    } catch (error) {
      console.error('Error fetching client context:', error)
      return null
    }
  }

  /**
   * Inject client context into system prompt
   */
  private injectClientContext(systemPrompt: string, context: AIClientContext): string {
    const contextParts = [`\n\nKLANT CONTEXT (${context.clientName}):`]

    if (context.proposition) contextParts.push(`Propositie: ${context.proposition}`)
    if (context.targetAudience) contextParts.push(`Doelgroep: ${context.targetAudience}`)
    if (context.usps.length > 0) contextParts.push(`USP's: ${context.usps.join(', ')}`)
    if (context.toneOfVoice) contextParts.push(`Tone of Voice: ${context.toneOfVoice}`)
    if (context.brandVoice) contextParts.push(`Brand Voice: ${context.brandVoice}`)
    if (context.bestsellers?.length) contextParts.push(`Bestsellers: ${context.bestsellers.join(', ')}`)
    if (context.seasonality?.length) contextParts.push(`Seizoensgebonden: ${context.seasonality.join(', ')}`)
    if (context.margins) contextParts.push(`Marges: min ${context.margins.min}%, target ${context.margins.target}%`)
    if (context.activeChannels.length > 0) contextParts.push(`Actieve kanalen: ${context.activeChannels.join(', ')}`)

    // Compliance rules are critical
    if (context.doNotUse.length > 0) {
      contextParts.push(`\n⚠️ VERBODEN (gebruik deze woorden/claims NOOIT): ${context.doNotUse.join(', ')}`)
    }
    if (context.mustHave.length > 0) {
      contextParts.push(`✓ VERPLICHT (altijd toevoegen waar relevant): ${context.mustHave.join(', ')}`)
    }

    return systemPrompt + contextParts.join('\n')
  }

  // ============================================
  // Usage Logging (MVP - uses existing 'usage' table)
  // ============================================

  /**
   * Log usage to existing 'usage' table and update XP
   * MVP: Uses existing table structure, no new migrations needed
   */
  private async logUsage(
    userId: string,
    task: string,
    inputTokens: number,
    outputTokens: number,
    xpReward: number,
    clientId?: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Insert into existing usage table
      await supabase.from('usage').insert({
        user_id: userId,
        tool: task,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        client_id: clientId || null,
      })

      // Update user XP
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, total_generations')
        .eq('id', userId)
        .single()

      if (profile) {
        const newXp = (profile.xp || 0) + xpReward
        const newLevel = Math.floor(newXp / 100) + 1

        await supabase
          .from('profiles')
          .update({
            xp: newXp,
            level: newLevel,
            total_generations: (profile.total_generations || 0) + 1,
          })
          .eq('id', userId)
      }
    } catch (error) {
      console.error('Error logging usage:', error)
    }
  }

  // ============================================
  // Error Handling
  // ============================================

  private errorResult<T>(error: string, requestId: string, startTime: number): AIResult<T> {
    return {
      success: false,
      error,
      usage: {
        modelId: 'unknown',
        provider: 'anthropic',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        durationMs: Date.now() - startTime,
      },
      metadata: {
        templateId: 'unknown',
        templateVersion: '0.0.0',
        requestId,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// ============================================
// Singleton Export
// ============================================

let gatewayInstance: AIGateway | null = null

export function getAIGateway(): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway()
  }
  return gatewayInstance
}

// Convenience export for direct use
export const aiGateway = {
  generateText: <T = string>(request: AIGenerateRequest) =>
    getAIGateway().generateText<T>(request),
}
