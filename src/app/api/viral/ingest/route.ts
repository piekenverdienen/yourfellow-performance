/**
 * POST /api/viral/ingest
 *
 * Ingest trending signals from sources (Reddit, etc.)
 * Stores normalized signals in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestSignals, type IngestConfig } from '@/viral/ingest'
import { z } from 'zod'

// ============================================
// Request Validation
// ============================================

const IngestRequestSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  reddit: z.object({
    subreddits: z.array(z.string()).optional(),
    query: z.string().optional(),
    sort: z.enum(['hot', 'top', 'new', 'rising']).optional(),
    timeFilter: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).optional(),
    limit: z.number().min(1).max(100).optional(),
  }).optional(),
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

    // 2. Check internal access (feature flag)
    const isInternalOnly = process.env.VIRAL_HUB_INTERNAL_ONLY !== 'false'
    if (isInternalOnly) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // For MVP, only allow admin and marketer roles
      if (!profile || !['admin', 'marketer'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Access denied. Viral Hub is internal-only in MVP.' },
          { status: 403 }
        )
      }
    }

    // 3. Parse and validate request
    const body = await request.json()
    const validation = IngestRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { industry, reddit } = validation.data

    // 4. Build ingest config
    const config: IngestConfig = {
      industry,
    }

    if (reddit) {
      config.reddit = {
        subreddits: reddit.subreddits,
        query: reddit.query,
        sort: reddit.sort || 'hot',
        timeFilter: reddit.timeFilter || 'day',
        limit: reddit.limit || 25,
      }
    } else {
      // Default: use industry-related subreddits
      config.reddit = {
        query: industry,
        sort: 'hot',
        timeFilter: 'day',
        limit: 25,
      }
    }

    // 5. Run ingestion
    const result = await ingestSignals(config)

    // 6. Return result
    return NextResponse.json({
      success: result.success,
      data: {
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        signals: result.signals,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    })

  } catch (error) {
    console.error('Viral ingest error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
