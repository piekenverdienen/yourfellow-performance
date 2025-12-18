/**
 * Search Console Query History API
 *
 * GET /api/search-console/queries/[id]/history - Get historical data for a query
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get historical data
    const { data, error } = await supabase
      .from('search_console_query_history')
      .select('*')
      .eq('query_id', id)
      .order('date_start', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const history = (data || []).map(h => ({
      id: h.id,
      queryId: h.query_id,
      dateStart: h.date_start,
      dateEnd: h.date_end,
      impressions: h.impressions,
      clicks: h.clicks,
      position: h.position,
      ctr: h.ctr,
      syncedAt: h.synced_at,
    }))

    return NextResponse.json({ history })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
