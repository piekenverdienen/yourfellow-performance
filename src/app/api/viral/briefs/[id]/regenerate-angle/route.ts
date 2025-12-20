/**
 * POST /api/viral/briefs/[id]/regenerate-angle
 *
 * Regenerate a brief with a different angle.
 * Creates a new brief and marks the old one as 'superseded'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { regenerateBriefAngle, getBrief } from '@/viral/briefs'

// ============================================
// Request Schema
// ============================================

const RegenerateAngleRequestSchema = z.object({
  instruction: z.string().min(5).max(500).optional(),
})

// ============================================
// POST - Regenerate Brief with New Angle
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

    // 3. Check if brief exists
    const existingBrief = await getBrief(briefId)

    if (!existingBrief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      )
    }

    // Only allow regeneration of draft or rejected briefs
    if (!['draft', 'rejected'].includes(existingBrief.status)) {
      return NextResponse.json(
        { error: 'Can only regenerate draft or rejected briefs' },
        { status: 400 }
      )
    }

    // 4. Parse and validate request
    const body = await request.json()
    const validation = RegenerateAngleRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // 5. Regenerate with new angle
    const instruction = validation.data.instruction || 'Genereer een alternatieve invalshoek voor dezelfde brondata. Kies een ander perspectief of focus.'

    const result = await regenerateBriefAngle(briefId, instruction, user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to regenerate brief' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.brief,
      oldBriefId: briefId,
      message: 'New brief generated. Old brief marked as superseded.',
    })
  } catch (error) {
    console.error('Error regenerating brief:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
