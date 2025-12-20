/**
 * GET /api/viral/opportunities
 *
 * Retrieve stored viral opportunities.
 * PERFORMANCE: Cached for 2 minutes to reduce database load
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpportunities, type ViralChannel, type OpportunityStatus } from '@/viral/opportunities'
import { cache, CACHE_TTL } from '@/lib/cache'

// ============================================
// Route Handler
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

    // 3. Parse query params
    const { searchParams } = new URL(request.url)
    const industry = searchParams.get('industry') || undefined
    const channel = searchParams.get('channel') as ViralChannel | undefined
    const status = searchParams.get('status') as OpportunityStatus | undefined
    const clientId = searchParams.get('clientId') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Validate channel if provided
    if (channel && !['youtube', 'instagram', 'blog'].includes(channel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be youtube, instagram, or blog.' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !['new', 'shortlisted', 'generated', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be new, shortlisted, generated, or archived.' },
        { status: 400 }
      )
    }

    // 4. Get opportunities with caching
    // PERFORMANCE: Cache based on filter parameters
    const cacheKey = `opportunities:${clientId || 'all'}:${industry || 'all'}:${channel || 'all'}:${status || 'all'}:${limit}`

    const opportunities = await cache.getOrFetch(
      cacheKey,
      () => getOpportunities({
        industry,
        channel,
        status,
        clientId,
        limit,
      }),
      CACHE_TTL.OPPORTUNITIES
    )

    return NextResponse.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    })

  } catch (error) {
    console.error('Get opportunities error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
