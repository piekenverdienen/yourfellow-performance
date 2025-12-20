/**
 * POST /api/viral/briefs/[id]/generate-content
 *
 * Generate content from an approved brief.
 * Only works for briefs with status = 'approved'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateContentFromBrief, getBrief } from '@/viral/briefs'
import { ChannelSchema } from '@/viral/schemas'

// ============================================
// Request Schema
// ============================================

const GenerateContentRequestSchema = z.object({
  channel: ChannelSchema,
  options: z.object({
    targetAudience: z.string().optional(),
    videoLength: z.string().optional(),
    wordCount: z.number().optional(),
  }).optional(),
})

// ============================================
// POST - Generate Content from Brief
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: briefId } = await params

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

    // 3. Check if brief exists and is approved
    const brief = await getBrief(briefId)

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      )
    }

    if (brief.status !== 'approved') {
      return NextResponse.json(
        { error: 'Brief must be approved before generating content. Current status: ' + brief.status },
        { status: 400 }
      )
    }

    // 4. Parse and validate request
    const body = await request.json()
    const validation = GenerateContentRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { channel, options } = validation.data

    // 5. Generate content
    const result = await generateContentFromBrief(
      briefId,
      channel,
      user.id,
      options
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate content' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        generationId: result.generationId,
        channel: result.channel,
        output: result.output,
        tokens: result.tokens,
        briefId,
        status: 'generated',
      },
    })
  } catch (error) {
    console.error('Error generating content:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
