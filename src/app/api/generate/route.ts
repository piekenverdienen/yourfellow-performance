import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Fallback prompts in case database is unavailable
const FALLBACK_PROMPTS: Record<string, { system_prompt: string; xp_reward: number; model: string; max_tokens: number }> = {
  'google-ads-copy': {
    system_prompt: 'Je bent een expert Google Ads copywriter. Genereer headlines (max 30 chars) en descriptions (max 90 chars) in JSON format.',
    xp_reward: 10,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
  },
}

interface PromptTemplate {
  key: string
  name: string
  system_prompt: string
  model: string
  max_tokens: number
  xp_reward: number
  output_format: string
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { tool, prompt, options } = body

    // Validate input
    if (!tool || !prompt) {
      return NextResponse.json(
        { error: 'Tool and prompt are required' },
        { status: 400 }
      )
    }

    // Get template from database
    const template = await getPromptTemplate(tool)

    if (!template) {
      return NextResponse.json(
        { error: `Template '${tool}' niet gevonden.` },
        { status: 404 }
      )
    }

    // Build system prompt with user context if available
    let systemPrompt = template.system_prompt

    // Add user preferences to context if provided
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

    // Call Claude API
    const message = await anthropic.messages.create({
      model: template.model,
      max_tokens: template.max_tokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    let result = textContent ? textContent.text : ''

    // Strip markdown code blocks if present
    if (result.startsWith('```')) {
      result = result.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Calculate tokens used
    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    // Track usage and add XP (fire and forget)
    trackUsageAndXP(tool, template.xp_reward, tokensUsed, message.usage?.input_tokens || 0, message.usage?.output_tokens || 0)

    return NextResponse.json({
      success: true,
      result,
      tokens_used: tokensUsed,
      template_name: template.name,
    })

  } catch (error) {
    console.error('AI Generation error:', error)

    // Handle specific Anthropic errors
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

// Get prompt template from database
async function getPromptTemplate(toolKey: string): Promise<PromptTemplate | null> {
  try {
    const supabase = await createClient()

    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('key, name, system_prompt, model, max_tokens, xp_reward, output_format')
      .eq('key', toolKey)
      .eq('is_active', true)
      .single()

    if (error || !template) {
      console.log(`Template '${toolKey}' not found in database, using fallback`)
      // Return fallback if available
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
    // Return fallback on error
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

// Track usage and add XP to user
async function trackUsageAndXP(
  tool: string,
  xpReward: number,
  totalTokens: number,
  promptTokens: number,
  completionTokens: number
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('No authenticated user for XP tracking')
      return
    }

    // Insert usage record
    await supabase.from('usage').insert({
      user_id: user.id,
      tool,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    })

    // Update user XP and total generations
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + xpReward
      const newLevel = Math.floor(newXp / 100) + 1
      const newGenerations = (profile.total_generations || 0) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: newGenerations,
        })
        .eq('id', user.id)
    }
  } catch (error) {
    console.error('Error tracking usage/XP:', error)
  }
}
