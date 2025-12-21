/**
 * Search Console Query API - Single Query Operations
 *
 * GET /api/search-console/queries/[id] - Get query details
 * PATCH /api/search-console/queries/[id] - Update query (watching status)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryRowToQuery } from '@/types/search-console'
import type { SearchConsoleQueryRow } from '@/types/search-console'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get query
    const { data: queryData, error: queryError } = await supabase
      .from('search_console_queries')
      .select('*')
      .eq('id', id)
      .single()

    if (queryError || !queryData) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    const query = queryRowToQuery(queryData as SearchConsoleQueryRow)

    // Get pages for this query
    const { data: pagesData } = await supabase
      .from('search_console_query_pages')
      .select('*')
      .eq('query_id', id)
      .order('impressions', { ascending: false })

    interface QueryPageData {
      id: string
      query_id: string
      page_url: string
      impressions: number
      clicks: number
      position: number
      ctr: number
      mention_count: number | null
      in_title: boolean | null
      in_h1: boolean | null
      in_h2: boolean | null
      last_analyzed_at: string | null
    }
    const pages = (pagesData as QueryPageData[] || []).map((p: QueryPageData) => ({
      id: p.id,
      queryId: p.query_id,
      pageUrl: p.page_url,
      impressions: p.impressions,
      clicks: p.clicks,
      position: p.position,
      ctr: p.ctr,
      mentionCount: p.mention_count,
      inTitle: p.in_title,
      inH1: p.in_h1,
      inH2: p.in_h2,
      lastAnalyzedAt: p.last_analyzed_at,
    }))

    // Get clusters this query belongs to
    const { data: clusterData } = await supabase
      .from('topic_cluster_queries')
      .select('cluster_id, topic_clusters(id, name, color)')
      .eq('query_id', id)

    interface ClusterQueryData {
      cluster_id: string
      topic_clusters: {
        id: string
        name: string
        color: string
      } | null
    }
    const clusters = (clusterData as ClusterQueryData[] || []).map((c: ClusterQueryData) => ({
      id: c.topic_clusters?.id,
      name: c.topic_clusters?.name,
      color: c.topic_clusters?.color,
    })).filter(c => c.id)

    return NextResponse.json({
      query: {
        ...query,
        pages,
        clusters,
      },
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Build update object
    const updates: Record<string, unknown> = {}

    if (typeof body.isWatching === 'boolean') {
      updates.is_watching = body.isWatching
    }

    if (typeof body.hasRelevantPage === 'boolean') {
      updates.has_relevant_page = body.hasRelevantPage
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update query
    const { data, error } = await supabase
      .from('search_console_queries')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ query: queryRowToQuery(data as SearchConsoleQueryRow) })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
