/**
 * AI Generate API Route
 *
 * MIGRATED VERSION - Uses AI Gateway for supported tasks
 *
 * This route maintains backward compatibility with the existing frontend.
 * Tasks that are migrated to the gateway:
 * - google-ads-copy → gateway (google_ads_copy)
 * - image-prompt → gateway (image_prompt)
 *
 * Other tasks use the legacy code path until migrated.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getAIGateway, type AITask } from '@/lib/ai'

// ============================================
// Task Mapping (frontend tool → gateway task)
// ============================================

const GATEWAY_TASKS: Record<string, AITask> = {
  'google-ads-copy': 'google_ads_copy',
  'image-prompt': 'image_prompt',
  'social-copy': 'social_post',
  'seo-content': 'seo_content',
  'seo-meta': 'seo_meta',
  'cro-analyzer': 'cro_analysis',
}

// ============================================
// Legacy Fallback Prompts (for non-migrated tools)
// ============================================

const FALLBACK_PROMPTS: Record<string, { system_prompt: string; xp_reward: number; model: string; max_tokens: number }> = {
  // Legacy tools that haven't been migrated yet
}

// ============================================
// Main Route Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user for logging
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { tool, prompt, options, clientId } = body

    // Validate input
    if (!tool || !prompt) {
      return NextResponse.json(
        { error: 'Tool and prompt are required' },
        { status: 400 }
      )
    }

    // Check if this tool uses the gateway
    const gatewayTask = GATEWAY_TASKS[tool]

    if (gatewayTask) {
      // ==========================================
      // NEW PATH: Use AI Gateway
      // ==========================================
      return handleGatewayRequest(gatewayTask, tool, prompt, options, clientId, user?.id)
    } else {
      // ==========================================
      // LEGACY PATH: Direct Anthropic call
      // ==========================================
      return handleLegacyRequest(tool, prompt, options, clientId, supabase)
    }

  } catch (error) {
    console.error('AI Generation error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Ongeldige API key. Controleer de configuratie.' },
          { status: 401 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Te veel verzoeken. Wacht even en probeer opnieuw.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}

// ============================================
// Gateway Request Handler
// ============================================

async function handleGatewayRequest(
  task: AITask,
  tool: string,
  prompt: string,
  options: Record<string, unknown> | undefined,
  clientId: string | undefined,
  userId: string | undefined
) {
  const gateway = getAIGateway()

  // Parse the prompt into input variables based on task
  const input = parsePromptToInput(task, prompt, options)

  const result = await gateway.generateText({
    task,
    clientId,
    input,
    options: {
      userId,
    },
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Generatie mislukt' },
      { status: 500 }
    )
  }

  // Return in the same format as before (backward compatible)
  return NextResponse.json({
    success: true,
    result: typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data),
    tokens_used: result.usage.totalTokens,
    template_name: tool,
    // Extra info (optional, frontend can ignore)
    _gateway: {
      model: result.usage.modelId,
      cost: result.usage.estimatedCost,
      durationMs: result.usage.durationMs,
    },
  })
}

/**
 * Parse frontend prompt string into structured input for gateway
 */
function parsePromptToInput(
  task: AITask,
  prompt: string,
  options?: Record<string, unknown>
): Record<string, unknown> {
  // For google_ads_copy, the prompt is already structured in the frontend
  // We pass it through and let the template handle it
  if (task === 'google_ads_copy') {
    // Try to parse as JSON first (new format)
    try {
      const parsed = JSON.parse(prompt)
      return {
        product_name: parsed.product_name || '',
        product_description: parsed.product_description || '',
        target_audience: parsed.target_audience || '',
        keywords: parsed.keywords || [],
        tone: parsed.tone || 'professional',
        landing_page_content: parsed.landing_page_content || '',
      }
    } catch {
      // Fallback: use prompt as-is (old format)
      return {
        product_name: '',
        product_description: prompt,
        target_audience: '',
        keywords: [],
        tone: 'professional',
        landing_page_content: '',
      }
    }
  }

  if (task === 'image_prompt') {
    return {
      platform: (options as Record<string, unknown>)?.platform || 'general',
      content: prompt,
    }
  }

  if (task === 'social_post') {
    // Parse the structured prompt from frontend
    const lines = prompt.split('\n')
    const getValue = (key: string) => {
      const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'))
      return line ? line.substring(line.indexOf(':') + 1).trim() : ''
    }

    return {
      platform: getValue('Platform') || (options as Record<string, unknown>)?.platform || 'linkedin',
      topic: getValue('Onderwerp'),
      context: getValue('Context/Details') || getValue('Context'),
      target_audience: getValue('Doelgroep'),
      tone: getValue('Tone of voice') || (options as Record<string, unknown>)?.tone || 'professional',
      post_type: getValue('Type post') || 'announcement',
    }
  }

  if (task === 'seo_content') {
    // Parse the structured prompt from frontend
    const lines = prompt.split('\n')
    const getValue = (key: string) => {
      const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'))
      return line ? line.substring(line.indexOf(':') + 1).trim() : ''
    }

    return {
      topic: getValue('Onderwerp'),
      primary_keyword: getValue('Primair keyword'),
      secondary_keywords: getValue('Secundaire keywords'),
      target_audience: getValue('Doelgroep'),
      content_type: getValue('Type content') || (options as Record<string, unknown>)?.contentType || 'blog',
      length: getValue('Gewenste lengte') || (options as Record<string, unknown>)?.length || 'medium',
      tone: getValue('Tone of voice') || 'professional',
    }
  }

  if (task === 'seo_meta') {
    // Parse the structured prompt from frontend
    const lines = prompt.split('\n')
    const getValue = (key: string) => {
      const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'))
      return line ? line.substring(line.indexOf(':') + 1).trim() : ''
    }

    // Page content might span multiple lines, so we need to extract it differently
    const pageContentMatch = prompt.match(/Pagina inhoud\/context:\s*([\s\S]*?)(?=$)/i)
    const pageContent = pageContentMatch ? pageContentMatch[1].trim() : getValue('Pagina inhoud')

    return {
      page_url: getValue('URL'),
      page_content: pageContent,
      primary_keyword: getValue('Primair keyword'),
      brand_name: getValue('Merknaam'),
      page_type: getValue('Type pagina') || (options as Record<string, unknown>)?.pageType || 'homepage',
    }
  }

  if (task === 'cro_analysis') {
    // Parse the structured prompt from frontend
    const lines = prompt.split('\n')
    const getValue = (key: string) => {
      const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'))
      return line ? line.substring(line.indexOf(':') + 1).trim() : ''
    }

    // Page content might span multiple lines
    const pageContentMatch = prompt.match(/Pagina inhoud:\s*([\s\S]*?)(?=$)/i)
    const pageContent = pageContentMatch ? pageContentMatch[1].trim() : ''

    return {
      url: getValue('URL'),
      page_type: getValue('Type pagina'),
      page_content: pageContent,
    }
  }

  // Default: pass prompt as content
  return { content: prompt }
}

// ============================================
// Legacy Request Handler (for non-migrated tools)
// ============================================

async function handleLegacyRequest(
  tool: string,
  prompt: string,
  options: Record<string, unknown> | undefined,
  clientId: string | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return NextResponse.json(
      { error: 'API configuratie ontbreekt. Contacteer de beheerder.' },
      { status: 500 }
    )
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // Get template from database
  const template = await getLegacyTemplate(tool, supabase)

  if (!template) {
    return NextResponse.json(
      { error: `Template '${tool}' niet gevonden.` },
      { status: 404 }
    )
  }

  // Build system prompt
  let systemPrompt = template.system_prompt

  // Add user context if provided
  if (options?.userContext) {
    const ctx = options.userContext as Record<string, string>
    const contextParts = []
    if (ctx.company_name) contextParts.push(`Bedrijf: ${ctx.company_name}`)
    if (ctx.industry) contextParts.push(`Branche: ${ctx.industry}`)
    if (ctx.target_audience) contextParts.push(`Doelgroep: ${ctx.target_audience}`)
    if (ctx.brand_voice) contextParts.push(`Merkstem: ${ctx.brand_voice}`)
    if (ctx.preferred_tone) contextParts.push(`Toon: ${ctx.preferred_tone}`)

    if (contextParts.length > 0) {
      systemPrompt = `${systemPrompt}\n\nCONTEXT GEBRUIKER:\n${contextParts.join('\n')}`
    }
  }

  // Add client context if provided
  if (clientId) {
    const clientContext = await getClientContext(supabase, clientId)
    if (clientContext) {
      systemPrompt = `${systemPrompt}\n\n${clientContext}`
    }
  }

  // Call Claude API
  const message = await anthropic.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  // Extract text content
  const textContent = message.content.find(block => block.type === 'text')
  let result = textContent ? textContent.text : ''

  // Strip markdown code blocks if present
  if (result.startsWith('```')) {
    result = result.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

  // Track usage (fire and forget)
  trackUsageAndXP(
    supabase,
    tool,
    template.xp_reward,
    tokensUsed,
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
    clientId
  )

  return NextResponse.json({
    success: true,
    result,
    tokens_used: tokensUsed,
    template_name: template.name,
  })
}

// ============================================
// Legacy Helper Functions
// ============================================

interface LegacyTemplate {
  key: string
  name: string
  system_prompt: string
  model: string
  max_tokens: number
  xp_reward: number
  output_format: string
}

async function getLegacyTemplate(
  toolKey: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<LegacyTemplate | null> {
  try {
    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('key, name, system_prompt, model, max_tokens, xp_reward, output_format')
      .eq('key', toolKey)
      .eq('is_active', true)
      .single()

    if (error || !template) {
      const fallback = FALLBACK_PROMPTS[toolKey]
      if (fallback) {
        return {
          key: toolKey,
          name: toolKey,
          ...fallback,
          output_format: 'json',
        }
      }
      return null
    }

    return template
  } catch (error) {
    console.error('Error fetching template:', error)
    const fallback = FALLBACK_PROMPTS[toolKey]
    if (fallback) {
      return {
        key: toolKey,
        name: toolKey,
        ...fallback,
        output_format: 'json',
      }
    }
    return null
  }
}

async function getClientContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<string | null> {
  try {
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

    if (!clientAccess) return null

    const { data: client } = await supabase
      .from('clients')
      .select('name, settings')
      .eq('id', clientId)
      .single()

    if (!client) return null

    const clientName = client.name
    const clientContext = (client.settings as { context?: Record<string, unknown> })?.context

    if (!clientContext) return null

    const ctx = clientContext as {
      proposition?: string
      targetAudience?: string
      usps?: string[]
      toneOfVoice?: string
      brandVoice?: string
      doNots?: string[]
      mustHaves?: string[]
      bestsellers?: string[]
      seasonality?: string[]
      margins?: { min?: number; target?: number }
      activeChannels?: string[]
    }

    const contextParts = [`Je werkt nu voor klant: ${clientName}`]

    if (ctx.proposition) contextParts.push(`Propositie: ${ctx.proposition}`)
    if (ctx.targetAudience) contextParts.push(`Doelgroep: ${ctx.targetAudience}`)
    if (ctx.usps?.length) contextParts.push(`USP's: ${ctx.usps.join(', ')}`)
    if (ctx.toneOfVoice) contextParts.push(`Tone of Voice: ${ctx.toneOfVoice}`)
    if (ctx.brandVoice) contextParts.push(`Brand Voice: ${ctx.brandVoice}`)
    if (ctx.bestsellers?.length) contextParts.push(`Bestsellers: ${ctx.bestsellers.join(', ')}`)
    if (ctx.seasonality?.length) contextParts.push(`Seizoensgebonden: ${ctx.seasonality.join(', ')}`)
    if (ctx.margins) contextParts.push(`Marges: min ${ctx.margins.min || 0}%, target ${ctx.margins.target || 0}%`)
    if (ctx.activeChannels?.length) contextParts.push(`Actieve kanalen: ${ctx.activeChannels.join(', ')}`)

    if (ctx.doNots?.length) {
      contextParts.push(`\n⚠️ VERBODEN (gebruik deze woorden/claims NOOIT): ${ctx.doNots.join(', ')}`)
    }
    if (ctx.mustHaves?.length) {
      contextParts.push(`✓ VERPLICHT (altijd toevoegen waar relevant): ${ctx.mustHaves.join(', ')}`)
    }

    return `KLANT CONTEXT (${clientName}):\n${contextParts.join('\n')}`
  } catch (error) {
    console.error('Error fetching client context:', error)
    return null
  }
}

async function trackUsageAndXP(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tool: string,
  xpReward: number,
  totalTokens: number,
  promptTokens: number,
  completionTokens: number,
  clientId?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('usage').insert({
      user_id: user.id,
      tool,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      client_id: clientId || null,
    })

    let streakBonus = 0
    try {
      const { data: streakResult } = await supabase
        .rpc('update_user_streak', { user_uuid: user.id })
      if (streakResult?.[0]?.streak_bonus) {
        streakBonus = streakResult[0].streak_bonus
      }
    } catch {
      // Streak table might not exist
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + xpReward + streakBonus
      const newLevel = Math.floor(newXp / 100) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: (profile.total_generations || 0) + 1,
        })
        .eq('id', user.id)
    }

    // Check for new achievements (fire and forget)
    void (async () => {
      try {
        await supabase.rpc('check_achievements', { user_uuid: user.id })
      } catch {
        // Achievement check failed, continue silently
      }
    })()
  } catch (error) {
    console.error('Error tracking usage/XP:', error)
  }
}
