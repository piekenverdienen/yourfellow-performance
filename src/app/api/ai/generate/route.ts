/**
 * AI Generate API Route
 *
 * New unified endpoint for AI generation using the AI Gateway.
 * This replaces direct model calls with a task-based interface.
 *
 * Usage:
 * POST /api/ai/generate
 * {
 *   "task": "google_ads_copy",
 *   "input": { "product_name": "...", "keywords": ["..."] },
 *   "clientId": "optional-client-uuid"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiGateway, type AITask, type AIGenerateRequest } from '@/lib/ai'

// Valid tasks that can be requested
const VALID_TASKS: AITask[] = [
  'google_ads_copy',
  'social_post',
  'seo_content',
  'seo_meta',
  'image_prompt',
  'cro_analysis',
]

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet geautoriseerd. Log opnieuw in.' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { task, input, clientId, options } = body as {
      task: AITask
      input: Record<string, unknown>
      clientId?: string
      options?: {
        temperature?: number
        maxTokens?: number
      }
    }

    // 3. Validate task
    if (!task || !VALID_TASKS.includes(task)) {
      return NextResponse.json(
        { error: `Ongeldige task. Kies uit: ${VALID_TASKS.join(', ')}` },
        { status: 400 }
      )
    }

    // 4. Validate input
    if (!input || typeof input !== 'object') {
      return NextResponse.json(
        { error: 'Input is verplicht en moet een object zijn' },
        { status: 400 }
      )
    }

    // 5. Verify client access if clientId provided
    if (clientId) {
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Geen toegang tot deze klant' },
          { status: 403 }
        )
      }
    }

    // 6. Call AI Gateway
    const aiRequest: AIGenerateRequest = {
      task,
      clientId,
      input,
      options: {
        userId: user.id,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      },
    }

    const result = await aiGateway.generateText(aiRequest)

    // 7. Return result
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'AI generatie mislukt' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: {
        tokens: result.usage.totalTokens,
        cost: result.usage.estimatedCost,
        durationMs: result.usage.durationMs,
        model: result.usage.modelId,
      },
      metadata: {
        templateId: result.metadata.templateId,
        templateVersion: result.metadata.templateVersion,
        requestId: result.metadata.requestId,
      },
    })

  } catch (error) {
    console.error('AI Generate error:', error)

    return NextResponse.json(
      { error: 'Er ging iets mis. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for available tasks and their descriptions
 */
export async function GET() {
  return NextResponse.json({
    tasks: VALID_TASKS.map(task => ({
      id: task,
      name: taskNames[task] || task,
      description: taskDescriptions[task] || '',
    })),
  })
}

// Task metadata
const taskNames: Record<AITask, string> = {
  google_ads_copy: 'Google Ads Copy',
  social_post: 'Social Media Post',
  seo_content: 'SEO Content',
  seo_meta: 'SEO Meta Tags',
  image_prompt: 'Image Prompt',
  cro_analysis: 'CRO Analyse',
  chat: 'Chat',
  workflow_agent: 'Workflow Agent',
  content_evaluation: 'Content Evaluatie',
}

const taskDescriptions: Record<AITask, string> = {
  google_ads_copy: 'Genereer headlines en descriptions voor Google Ads',
  social_post: 'Maak posts voor LinkedIn, Instagram, Facebook of Twitter',
  seo_content: 'Schrijf SEO-geoptimaliseerde content',
  seo_meta: 'Genereer meta titles en descriptions',
  image_prompt: 'Maak prompts voor AI image generators',
  cro_analysis: 'Analyseer landingspaginas op conversie-optimalisatie',
  chat: 'Chat met AI assistenten',
  workflow_agent: 'AI agent voor workflows',
  content_evaluation: 'Evalueer gegenereerde content',
}
