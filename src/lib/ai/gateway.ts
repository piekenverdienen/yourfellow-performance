/**
 * AI Gateway Service
 *
 * Central service for all AI operations.
 * Handles model selection, template rendering, client context, and usage logging.
 */

import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, isProviderAvailable } from './providers'
import { getModel, getModelForTask, getFallbackModelForTask, calculateCost } from './models'
import type {
  AIGenerateRequest,
  AIResult,
  AITask,
  AIClientContext,
  PromptTemplate,
  AIUsageLog,
  ModelConfig,
} from './types'

// ============================================
// Template Cache (in-memory, cleared on deploy)
// ============================================

const templateCache = new Map<string, { template: PromptTemplate; cachedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ============================================
// Main Gateway Class
// ============================================

export class AIGateway {
  /**
   * Generate text using AI
   *
   * This is the main entry point for all text generation.
   * It handles:
   * - Model selection based on task
   * - Template fetching and rendering
   * - Client context injection
   * - Usage logging
   * - Error handling with fallbacks
   */
  async generateText<T = string>(request: AIGenerateRequest): Promise<AIResult<T>> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    try {
      // 1. Get model configuration
      const model = request.options?.modelOverride
        ? getModel(request.options.modelOverride)
        : getModelForTask(request.task)

      if (!model) {
        return this.errorResult('No model available for this task', requestId, startTime)
      }

      // Check if provider is available
      if (!isProviderAvailable(model.provider)) {
        // Try fallback
        const fallback = getFallbackModelForTask(request.task)
        if (!fallback || !isProviderAvailable(fallback.provider)) {
          return this.errorResult('No AI provider available', requestId, startTime)
        }
        // Use fallback model
        return this.executeGeneration(request, fallback, requestId, startTime)
      }

      return this.executeGeneration(request, model, requestId, startTime)
    } catch (error) {
      console.error('AI Gateway error:', error)
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        requestId,
        startTime
      )
    }
  }

  /**
   * Execute the actual generation with a specific model
   */
  private async executeGeneration<T = string>(
    request: AIGenerateRequest,
    model: ModelConfig,
    requestId: string,
    startTime: number
  ): Promise<AIResult<T>> {
    // 2. Get template
    const template = await this.getTemplate(request.task, request.templateId)
    if (!template) {
      return this.errorResult(`No template found for task: ${request.task}`, requestId, startTime)
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

    // 5. Get provider adapter and execute
    const adapter = getProviderAdapter(model.provider)

    const result = await adapter.generateText({
      model: model.modelName,
      systemPrompt,
      userPrompt,
      maxTokens: request.options?.maxTokens || template.maxTokens,
      temperature: request.options?.temperature ?? template.temperature,
    })

    const durationMs = Date.now() - startTime
    const estimatedCost = calculateCost(model.id, result.inputTokens, result.outputTokens)

    // 6. Log usage (fire and forget)
    if (!request.options?.skipLogging) {
      this.logUsage({
        userId: request.options?.userId || '',
        clientId: request.clientId,
        templateId: template.id,
        templateVersion: template.version,
        modelId: model.id,
        provider: model.provider,
        task: request.task,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
        estimatedCost,
        durationMs,
        success: true,
      }).catch(console.error)
    }

    // 7. Parse result if output schema defined
    let data: T
    if (template.outputSchema) {
      try {
        data = JSON.parse(result.content) as T
      } catch {
        data = result.content as unknown as T
      }
    } else {
      data = result.content as unknown as T
    }

    return {
      success: true,
      data,
      usage: {
        modelId: model.id,
        provider: model.provider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
        estimatedCost,
        durationMs,
      },
      metadata: {
        templateId: template.id,
        templateVersion: template.version,
        clientId: request.clientId,
        requestId,
        timestamp: new Date().toISOString(),
      },
    }
  }

  // ============================================
  // Template Management
  // ============================================

  /**
   * Get template from database or cache
   */
  private async getTemplate(task: AITask, templateId?: string): Promise<PromptTemplate | null> {
    const cacheKey = templateId || `task:${task}`

    // Check cache
    const cached = templateCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.template
    }

    // Fetch from database
    try {
      const supabase = await createClient()

      let query = supabase
        .from('ai_templates')
        .select('*')
        .eq('is_active', true)

      if (templateId) {
        query = query.eq('id', templateId)
      } else {
        query = query.eq('task', task)
      }

      const { data, error } = await query
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        // Return fallback template
        return this.getFallbackTemplate(task)
      }

      const template: PromptTemplate = {
        id: data.id,
        task: data.task,
        version: data.version,
        name: data.name,
        description: data.description,
        systemPrompt: data.system_prompt,
        userPromptTemplate: data.user_prompt_template,
        outputSchema: data.output_schema,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        xpReward: data.xp_reward,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      // Cache it
      templateCache.set(cacheKey, { template, cachedAt: Date.now() })

      return template
    } catch (error) {
      console.error('Error fetching template:', error)
      return this.getFallbackTemplate(task)
    }
  }

  /**
   * Fallback templates when database is unavailable
   */
  private getFallbackTemplate(task: AITask): PromptTemplate | null {
    const fallbacks: Partial<Record<AITask, PromptTemplate>> = {
      google_ads_copy: {
        id: 'fallback-google-ads',
        task: 'google_ads_copy',
        version: '1.0.0',
        name: 'Google Ads Copy',
        systemPrompt: `Je bent een ervaren Google Ads copywriter. Schrijf advertentieteksten met hoge Quality Scores.

TECHNISCHE EISEN:
- Headlines: max 30 karakters
- Descriptions: max 90 karakters

OUTPUT: JSON met headlines[] en descriptions[]`,
        userPromptTemplate: `Product: {{product_name}}
Beschrijving: {{product_description}}
Doelgroep: {{target_audience}}
Keywords: {{keywords}}
Tone: {{tone}}`,
        outputSchema: {
          type: 'object',
          properties: {
            headlines: { type: 'array', items: { type: 'string' } },
            descriptions: { type: 'array', items: { type: 'string' } },
          },
        },
        temperature: 0.7,
        maxTokens: 2048,
        xpReward: 10,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      image_prompt: {
        id: 'fallback-image-prompt',
        task: 'image_prompt',
        version: '1.0.0',
        name: 'Image Prompt',
        systemPrompt: `Je bent een expert image prompt engineer. Schrijf visueel beschrijvende prompts voor AI image generators.

OUTPUT: Alleen de image prompt in het Engels, max 80 woorden.`,
        userPromptTemplate: `Platform: {{platform}}
Post inhoud: {{content}}`,
        temperature: 0.8,
        maxTokens: 500,
        xpReward: 5,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    return fallbacks[task] || null
  }

  /**
   * Render template with variables
   */
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
  // Usage Logging
  // ============================================

  /**
   * Log usage to database
   */
  private async logUsage(log: Omit<AIUsageLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase.from('ai_usage_logs').insert({
        user_id: log.userId || null,
        client_id: log.clientId || null,
        template_id: log.templateId,
        template_version: log.templateVersion,
        model_id: log.modelId,
        provider: log.provider,
        task: log.task,
        input_tokens: log.inputTokens,
        output_tokens: log.outputTokens,
        total_tokens: log.totalTokens,
        estimated_cost: log.estimatedCost,
        duration_ms: log.durationMs,
        success: log.success,
        error_message: log.errorMessage || null,
        metadata: log.metadata || null,
      })

      // Also update XP if userId provided
      if (log.userId && log.success) {
        await this.addXPReward(log.userId, log.task)
      }
    } catch (error) {
      console.error('Error logging usage:', error)
    }
  }

  /**
   * Add XP reward to user
   */
  private async addXPReward(userId: string, task: AITask): Promise<void> {
    try {
      const supabase = await createClient()

      // Get XP reward from template
      const template = await this.getTemplate(task)
      const xpReward = template?.xpReward || 5

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
      console.error('Error adding XP:', error)
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
