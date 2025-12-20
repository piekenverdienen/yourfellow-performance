/**
 * POST /api/viral/opportunities/build
 *
 * Build opportunities from ingested signals.
 * Clusters signals, scores them, and stores opportunities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildOpportunities, type ViralChannel } from '@/viral/opportunities'
import { z } from 'zod'

// ============================================
// Request Validation
// ============================================

const BuildRequestSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  clientId: z.string().uuid().optional(),
  channels: z.array(z.enum(['youtube', 'instagram', 'blog'])).min(1, 'At least one channel required'),
  limit: z.number().min(1).max(50).optional(),
  days: z.number().min(1).max(30).optional(),
  useAI: z.boolean().optional(),
})

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

    // 3. Parse and validate request
    const body = await request.json()
    const validation = BuildRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { industry, clientId, channels, limit, days, useAI } = validation.data

    // 4. Validate client access if clientId provided
    if (clientId) {
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'editor' })

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No access to specified client' },
          { status: 403 }
        )
      }
    }

    // 5. Build opportunities
    const opportunities = await buildOpportunities({
      industry,
      clientId,
      channels: channels as ViralChannel[],
      limit: limit || 10,
      days: days || 7,
      useAI: useAI ?? false,
    })

    return NextResponse.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    })

  } catch (error) {
    console.error('Build opportunities error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
