/**
 * POST /api/viral/suggest-config
 *
 * Uses AI to analyze client context and suggest optimal
 * Viral Hub configuration (subreddits, industry, search terms).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AIGateway } from '@/lib/ai/gateway'
import { z } from 'zod'
import type { ClientContext } from '@/types'

// ============================================
// Request Validation
// ============================================

const SuggestConfigSchema = z.object({
  clientId: z.string().uuid(),
})

// ============================================
// Response Types
// ============================================

interface ConfigSuggestion {
  subreddits: string[]
  industry: string
  searchTerms: string[]
  reasoning: string
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Check internal access
    const isInternalOnly = process.env.VIRAL_HUB_INTERNAL_ONLY !== 'false'
    if (isInternalOnly) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'marketer'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // 3. Parse request
    const body = await request.json()
    const validation = SuggestConfigSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { clientId } = validation.data

    // 4. Fetch client with context
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    const context = client.settings?.context as ClientContext | undefined

    if (!context || (!context.proposition && !context.targetAudience)) {
      return NextResponse.json(
        { error: 'Client has no AI Context configured' },
        { status: 400 }
      )
    }

    // 5. Call AI Gateway for suggestions
    const gateway = new AIGateway()
    const result = await gateway.generateText<ConfigSuggestion>({
      task: 'viral_config_suggestion',
      input: {
        client_name: client.name,
        proposition: context.proposition || 'Niet ingevuld',
        target_audience: context.targetAudience || 'Niet ingevuld',
        usps: context.usps?.join('\n- ') || 'Niet ingevuld',
        bestsellers: context.bestsellers?.join(', ') || 'Niet ingevuld',
        tone_of_voice: context.toneOfVoice || 'Niet ingevuld',
      },
      clientId: clientId,
      options: {
        userId: user.id,
      },
    })

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'AI generation failed' },
        { status: 500 }
      )
    }

    // 6. Return suggestions
    return NextResponse.json({
      success: true,
      data: {
        subreddits: result.data.subreddits || [],
        industry: result.data.industry || 'general',
        searchTerms: result.data.searchTerms || [],
        reasoning: result.data.reasoning || '',
      },
    })

  } catch (error) {
    console.error('Suggest config error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
