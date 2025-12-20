/**
 * GET /api/viral/briefs/[id] - Get a single brief
 * PATCH /api/viral/briefs/[id] - Update brief status (approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { getBrief, approveBrief, rejectBrief, getBriefGenerations } from '@/viral/briefs'

// ============================================
// GET - Get Brief with Generations
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Authenticate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Get the brief
    const brief = await getBrief(id)

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      )
    }

    // 3. Get generations for this brief
    const generations = await getBriefGenerations(id)

    return NextResponse.json({
      success: true,
      data: {
        ...brief,
        generations,
      },
    })
  } catch (error) {
    console.error('Error fetching brief:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH - Update Brief Status
// ============================================

const UpdateBriefSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // 3. Parse and validate request
    const body = await request.json()
    const validation = UpdateBriefSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // 4. Execute action
    let result: { success: boolean; error?: string }

    if (validation.data.action === 'approve') {
      result = await approveBrief(id, user.id)
    } else {
      result = await rejectBrief(id, validation.data.reason)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update brief' },
        { status: 400 }
      )
    }

    // 5. Get updated brief
    const updatedBrief = await getBrief(id)

    return NextResponse.json({
      success: true,
      data: updatedBrief,
    })
  } catch (error) {
    console.error('Error updating brief:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
