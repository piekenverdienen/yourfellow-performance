/**
 * GET /api/viral/briefs - List briefs
 * POST /api/viral/briefs - Generate a new brief
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateBrief, getBriefs } from '@/viral/briefs'
import { GenerateBriefRequestSchema } from '@/viral/schemas'

// ============================================
// GET - List Briefs
// ============================================

export async function GET(request: NextRequest) {
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

    // 2. Parse query params
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || undefined
    const status = searchParams.get('status') as 'draft' | 'approved' | 'rejected' | 'superseded' | undefined
    const ideaId = searchParams.get('ideaId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    // 3. Get briefs
    const briefs = await getBriefs({
      clientId,
      status,
      ideaId,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: briefs,
    })
  } catch (error) {
    console.error('Error fetching briefs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Generate a Brief
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
          { error: 'Access denied. Viral Hub is internal-only.' },
          { status: 403 }
        )
      }
    }

    // 3. Parse and validate request
    const body = await request.json()
    const validation = GenerateBriefRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // 4. Generate the brief
    const result = await generateBrief(validation.data, user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate brief' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.brief,
    })
  } catch (error) {
    console.error('Error generating brief:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
