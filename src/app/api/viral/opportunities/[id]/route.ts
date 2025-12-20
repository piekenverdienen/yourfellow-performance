/**
 * GET /api/viral/opportunities/[id]
 * PATCH /api/viral/opportunities/[id]
 *
 * Get or update a specific opportunity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpportunityWithSignals, updateOpportunityStatus, type OpportunityStatus } from '@/viral/opportunities'
import { getGenerationsForOpportunity } from '@/viral/generate'
import { z } from 'zod'

// ============================================
// GET Handler
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

    // 3. Get opportunity with signals
    const data = await getOpportunityWithSignals(id)

    if (!data) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      )
    }

    // 4. Get generations
    const generations = await getGenerationsForOpportunity(id)

    return NextResponse.json({
      success: true,
      data: {
        opportunity: data.opportunity,
        signals: data.signals,
        generations,
      },
    })

  } catch (error) {
    console.error('Get opportunity error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH Handler
// ============================================

const UpdateRequestSchema = z.object({
  status: z.enum(['new', 'shortlisted', 'generated', 'archived']),
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
    const validation = UpdateRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // 4. Update status
    await updateOpportunityStatus(id, validation.data.status as OpportunityStatus)

    return NextResponse.json({
      success: true,
      data: { id, status: validation.data.status },
    })

  } catch (error) {
    console.error('Update opportunity error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
