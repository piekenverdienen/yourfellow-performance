/**
 * Search Console Queries API
 *
 * GET /api/search-console/queries - List queries with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryRowToQuery } from '@/types/search-console'
import type { SearchConsoleQueryRow, QueryFilters, QuerySortField, SortOrder } from '@/types/search-console'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Parse parameters
    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // Parse filters
    const filters: QueryFilters = {}
    if (searchParams.get('watching') === 'true') filters.watching = true
    if (searchParams.get('hasRelevantPage') === 'true') filters.hasRelevantPage = true
    if (searchParams.get('isQuestion') === 'true') filters.isQuestion = true
    if (searchParams.get('isBuyerKeyword') === 'true') filters.isBuyerKeyword = true
    if (searchParams.get('isComparisonKeyword') === 'true') filters.isComparisonKeyword = true
    if (searchParams.get('isBranded') === 'true') filters.isBranded = true
    if (searchParams.get('nonBranded') === 'true') filters.nonBranded = true
    if (searchParams.get('noMentions') === 'true') filters.noMentions = true
    if (searchParams.get('noClicks') === 'true') filters.noClicks = true

    const minImpressions = searchParams.get('minImpressions')
    if (minImpressions) filters.minImpressions = parseInt(minImpressions, 10)

    const positionMin = searchParams.get('positionMin')
    if (positionMin) filters.positionMin = parseFloat(positionMin)

    const positionMax = searchParams.get('positionMax')
    if (positionMax) filters.positionMax = parseFloat(positionMax)

    const clusterId = searchParams.get('clusterId')
    if (clusterId) filters.clusterId = clusterId

    const search = searchParams.get('search')
    if (search) filters.search = search

    // Parse sorting
    const sortBy = (searchParams.get('sortBy') || 'uniqueImpressions') as QuerySortField
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as SortOrder

    // Parse pagination
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('search_console_queries')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)

    // Apply filters
    if (filters.watching) query = query.eq('is_watching', true)
    if (filters.hasRelevantPage) query = query.eq('has_relevant_page', true)
    if (filters.isQuestion) query = query.eq('is_question', true)
    if (filters.isBuyerKeyword) query = query.eq('is_buyer_keyword', true)
    if (filters.isComparisonKeyword) query = query.eq('is_comparison_keyword', true)
    if (filters.isBranded) query = query.eq('is_branded', true)
    if (filters.nonBranded) query = query.eq('is_branded', false)
    if (filters.noMentions) query = query.eq('mention_count', 0)
    if (filters.noClicks) query = query.eq('total_clicks', 0)
    if (filters.minImpressions) query = query.gte('unique_impressions', filters.minImpressions)
    if (filters.positionMin) query = query.gte('best_position', filters.positionMin)
    if (filters.positionMax) query = query.lte('best_position', filters.positionMax)
    if (filters.search) query = query.ilike('query', `%${filters.search}%`)

    // Handle cluster filter (requires join)
    if (filters.clusterId) {
      const { data: clusterQueries } = await supabase
        .from('topic_cluster_queries')
        .select('query_id')
        .eq('cluster_id', filters.clusterId)

      if (clusterQueries && clusterQueries.length > 0) {
        const queryIds = clusterQueries.map(cq => cq.query_id)
        query = query.in('id', queryIds)
      } else {
        // No queries in this cluster
        return NextResponse.json({
          queries: [],
          total: 0,
          hasMore: false,
          aggregates: {
            totalQueries: 0,
            totalImpressions: 0,
            totalClicks: 0,
            averagePosition: 0,
            watchingCount: 0,
            brandedCount: 0,
            questionsCount: 0,
            noMentionsCount: 0,
          },
        })
      }
    }

    // Map sortBy to database column
    const sortColumnMap: Record<QuerySortField, string> = {
      query: 'query',
      uniqueImpressions: 'unique_impressions',
      totalClicks: 'total_clicks',
      bestPosition: 'best_position',
      averageCtr: 'average_ctr',
      mentionCount: 'mention_count',
      pageCount: 'page_count',
      firstSeenAt: 'first_seen_at',
      lastSyncedAt: 'last_synced_at',
    }

    const sortColumn = sortColumnMap[sortBy] || 'unique_impressions'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to camelCase
    const queries = (data as SearchConsoleQueryRow[]).map(queryRowToQuery)

    // Get aggregates
    const { data: aggregateData } = await supabase
      .from('search_console_queries')
      .select('unique_impressions, total_clicks, best_position, is_watching, is_branded, is_question, mention_count')
      .eq('client_id', clientId)

    const aggregates = {
      totalQueries: count || 0,
      totalImpressions: 0,
      totalClicks: 0,
      averagePosition: 0,
      watchingCount: 0,
      brandedCount: 0,
      questionsCount: 0,
      noMentionsCount: 0,
    }

    if (aggregateData && aggregateData.length > 0) {
      let positionSum = 0
      let positionCount = 0

      for (const row of aggregateData) {
        aggregates.totalImpressions += row.unique_impressions || 0
        aggregates.totalClicks += row.total_clicks || 0
        if (row.best_position) {
          positionSum += row.best_position
          positionCount++
        }
        if (row.is_watching) aggregates.watchingCount++
        if (row.is_branded) aggregates.brandedCount++
        if (row.is_question) aggregates.questionsCount++
        if (row.mention_count === 0) aggregates.noMentionsCount++
      }

      aggregates.averagePosition = positionCount > 0 ? Math.round(positionSum / positionCount * 10) / 10 : 0
    }

    return NextResponse.json({
      queries,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      aggregates,
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
