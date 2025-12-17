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
