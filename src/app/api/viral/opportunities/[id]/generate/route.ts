/**
 * POST /api/viral/opportunities/[id]/generate
 *
 * Generate content packages for an opportunity.
 * Creates IG posts, YouTube scripts, and/or blog outlines.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateContentPackages, generateBlogDraft } from '@/viral/generate'
import { type ViralChannel } from '@/viral/opportunities'
import { z } from 'zod'

// ============================================
// Request Validation
// ============================================

const GenerateRequestSchema = z.object({
  channels: z.array(z.enum(['youtube', 'instagram', 'blog'])).min(1, 'At least one channel required'),
  options: z.object({
    targetAudience: z.string().optional(),
    videoLength: z.string().optional(),
    wordCount: z.number().optional(),
  }).optional(),
})

const DraftRequestSchema = z.object({
  action: z.literal('generate_draft'),
  outlineGenerationId: z.string().uuid(),
})

// ============================================
// Route Handler
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params

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

    // 3. Parse request body
    const body = await request.json()

    // Check if this is a draft generation request
    const draftValidation = DraftRequestSchema.safeParse(body)
    if (draftValidation.success) {
      // Generate blog draft from outline
      const draft = await generateBlogDraft(
        opportunityId,
        draftValidation.data.outlineGenerationId,
        user.id
      )

      return NextResponse.json({
        success: true,
        data: draft,
      })
    }

    // Standard generation request
    const validation = GenerateRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { channels, options } = validation.data

    // 4. Check opportunity exists and get client context
    const { data: opportunity } = await supabase
      .from('viral_opportunities')
      .select('id, client_id')
      .eq('id', opportunityId)
      .single()

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      )
    }

    // 5. Validate client access if opportunity has client
    if (opportunity.client_id) {
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: opportunity.client_id, min_role: 'editor' })

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No access to opportunity client' },
          { status: 403 }
        )
      }
    }

    // 6. Generate content packages
    const result = await generateContentPackages({
      opportunityId,
      channels: channels as ViralChannel[],
      userId: user.id,
      clientId: opportunity.client_id,
      options,
    })

    return NextResponse.json({
      success: result.success,
      data: result.generations,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })

  } catch (error) {
    console.error('Generate content error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
