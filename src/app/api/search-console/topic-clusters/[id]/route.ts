/**
 * Topic Cluster API - Single Cluster Operations
 *
 * GET /api/search-console/topic-clusters/[id] - Get cluster details
 * PATCH /api/search-console/topic-clusters/[id] - Update cluster
 * DELETE /api/search-console/topic-clusters/[id] - Delete cluster
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { topicClusterRowToModel, queryRowToQuery } from '@/types/search-console'
import { matchQueriesToClusters } from '@/services/search-console-sync'
import type { TopicClusterRow, SearchConsoleQueryRow } from '@/types/search-console'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get cluster
    const { data: clusterData, error: clusterError } = await supabase
      .from('topic_clusters')
      .select('*')
      .eq('id', id)
      .single()

    if (clusterError || !clusterData) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    const cluster = topicClusterRowToModel(clusterData as TopicClusterRow)

    // Get queries in this cluster
    const { data: clusterQueries } = await supabase
      .from('topic_cluster_queries')
      .select('query_id, matched_by')
      .eq('cluster_id', id)

    if (clusterQueries && clusterQueries.length > 0) {
      const queryIds = clusterQueries.map((cq: { query_id: string }) => cq.query_id)

      const { data: queriesData } = await supabase
        .from('search_console_queries')
        .select('*')
        .in('id', queryIds)
        .order('unique_impressions', { ascending: false })

      cluster.queries = (queriesData as SearchConsoleQueryRow[] || []).map(queryRowToQuery)
    } else {
      cluster.queries = []
    }

    return NextResponse.json({ cluster })
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

    // Get current cluster for client ID
    const { data: currentCluster } = await supabase
      .from('topic_clusters')
      .select('client_id')
      .eq('id', id)
      .single()

    if (!currentCluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.color !== undefined) updates.color = body.color
    if (body.matchKeywords !== undefined) {
      updates.match_keywords = body.matchKeywords.map((k: string) => k.toLowerCase().trim())
    }
    if (body.matchRegex !== undefined) updates.match_regex = body.matchRegex?.trim() || null

    // Update cluster
    const { data, error } = await supabase
      .from('topic_clusters')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Re-match queries if keywords changed
    if (body.matchKeywords !== undefined || body.matchRegex !== undefined) {
      try {
        // Clear existing mappings for this cluster
        await supabase
          .from('topic_cluster_queries')
          .delete()
          .eq('cluster_id', id)

        // Re-match
        await matchQueriesToClusters(currentCluster.client_id)
      } catch (matchError) {
        console.error('Error re-matching queries:', matchError)
      }
    }

    return NextResponse.json({
      cluster: topicClusterRowToModel(data as TopicClusterRow),
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Delete cluster (cascades to topic_cluster_queries)
    const { error } = await supabase
      .from('topic_clusters')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
