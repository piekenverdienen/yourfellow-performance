/**
 * Cluster Analysis API
 *
 * POST /api/seo/clusters/analyze - Analyze a topic cluster with Claude
 *
 * Request body:
 * {
 *   clientId: string
 *   clusterId: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   data?: TopicalClusterReport
 *   error?: string
 *   timing?: { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TopicalClusterAnalyzer } from '@/seo/topical'
import type { ClusterQueryData, ClusterUrlData, ClusterAnalysisResponse } from '@/seo/topical'
import type { TopicClusterRow } from '@/types/search-console'

interface ClusterQueryRow {
  query_id: string
  matched_by: string
  search_console_queries: {
    id: string
    query: string
    unique_impressions: number
    total_clicks: number
    best_position: number | null
    average_ctr: number | null
    is_question: boolean
    is_buyer_keyword: boolean
  } | null
}

export async function POST(request: NextRequest): Promise<NextResponse<ClusterAnalysisResponse>> {
  const startTime = performance.now()
  let dataFetchTime = 0
  let scoringTime = 0
  let llmTime = 0

  try {
    const supabase = await createClient()
    const body = await request.json()

    const { clientId, clusterId } = body

    if (!clientId || !clusterId) {
      return NextResponse.json(
        { success: false, error: 'clientId and clusterId are required' },
        { status: 400 }
      )
    }

    // Fetch cluster details
    const fetchStart = performance.now()

    const { data: cluster, error: clusterError } = await supabase
      .from('topic_clusters')
      .select('*')
      .eq('id', clusterId)
      .eq('client_id', clientId)
      .single()

    if (clusterError || !cluster) {
      return NextResponse.json(
        { success: false, error: 'Cluster not found' },
        { status: 404 }
      )
    }

    const typedCluster = cluster as TopicClusterRow

    // Fetch all queries in this cluster with their pages
    const { data: clusterQueries, error: queriesError } = await supabase
      .from('topic_cluster_queries')
      .select(`
        query_id,
        matched_by,
        search_console_queries (
          id,
          query,
          unique_impressions,
          total_clicks,
          best_position,
          average_ctr,
          is_question,
          is_buyer_keyword
        )
      `)
      .eq('cluster_id', clusterId)

    if (queriesError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch queries: ${queriesError.message}` },
        { status: 500 }
      )
    }

    if (!clusterQueries || clusterQueries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No queries found in this cluster. Sync data first or check cluster matching rules.' },
        { status: 400 }
      )
    }

    // Get query IDs for fetching pages
    const queryIds = (clusterQueries as ClusterQueryRow[])
      .map((cq: ClusterQueryRow) => cq.search_console_queries?.id)
      .filter((id): id is string => !!id)

    // Fetch all pages for these queries
    const { data: queryPages, error: pagesError } = await supabase
      .from('search_console_query_pages')
      .select('query_id, page_url, impressions, clicks, position')
      .in('query_id', queryIds)

    if (pagesError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch pages: ${pagesError.message}` },
        { status: 500 }
      )
    }

    dataFetchTime = performance.now() - fetchStart

    // Transform data for the analyzer
    const scoringStart = performance.now()

    // Build query data with ranking URLs
    const queryUrlMap = new Map<string, string[]>()
    for (const page of queryPages || []) {
      const existing = queryUrlMap.get(page.query_id) || []
      existing.push(page.page_url)
      queryUrlMap.set(page.query_id, existing)
    }

    const queries: ClusterQueryData[] = (clusterQueries as ClusterQueryRow[])
      .map((cq: ClusterQueryRow) => {
        const q = cq.search_console_queries

        if (!q) return null

        return {
          query: q.query,
          impressions: q.unique_impressions,
          clicks: q.total_clicks,
          ctr: q.average_ctr || 0,
          position: q.best_position || 50,
          rankingUrls: queryUrlMap.get(q.id) || [],
          isQuestion: q.is_question,
          isBuyerKeyword: q.is_buyer_keyword,
        }
      })
      .filter((q): q is ClusterQueryData => q !== null)
      .sort((a, b) => b.impressions - a.impressions)

    // Build URL data by aggregating across queries
    const urlMetrics = new Map<string, {
      queryCount: number
      impressions: number
      clicks: number
      positions: number[]
    }>()

    for (const page of queryPages || []) {
      const existing = urlMetrics.get(page.page_url)
      if (existing) {
        existing.queryCount++
        existing.impressions += page.impressions
        existing.clicks += page.clicks
        if (page.position) existing.positions.push(page.position)
      } else {
        urlMetrics.set(page.page_url, {
          queryCount: 1,
          impressions: page.impressions,
          clicks: page.clicks,
          positions: page.position ? [page.position] : [],
        })
      }
    }

    const urls: ClusterUrlData[] = Array.from(urlMetrics.entries())
      .map(([url, metrics]) => ({
        url,
        queryCount: metrics.queryCount,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        avgPosition: metrics.positions.length > 0
          ? metrics.positions.reduce((a, b) => a + b, 0) / metrics.positions.length
          : 50,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    // Calculate totals
    const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
    const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
    const weightedPosition = queries.reduce((sum, q) => sum + q.position * q.impressions, 0)
    const avgPosition = totalImpressions > 0 ? weightedPosition / totalImpressions : 50
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0

    scoringTime = performance.now() - scoringStart

    // Run the analysis
    const llmStart = performance.now()

    const analyzer = new TopicalClusterAnalyzer()
    const report = await analyzer.analyze({
      clusterName: typedCluster.name,
      clusterDescription: typedCluster.description || undefined,
      totalQueries: queries.length,
      totalImpressions,
      totalClicks,
      avgPosition,
      avgCtr,
      queries,
      urls,
      calculatedMaturityScore: 0, // Will be calculated by analyzer
    })

    llmTime = performance.now() - llmStart
    const totalTime = performance.now() - startTime

    return NextResponse.json({
      success: true,
      data: report,
      timing: {
        dataFetch: Math.round(dataFetchTime),
        scoring: Math.round(scoringTime),
        llm: Math.round(llmTime),
        total: Math.round(totalTime),
      },
    })
  } catch (error) {
    console.error('Cluster analysis error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
