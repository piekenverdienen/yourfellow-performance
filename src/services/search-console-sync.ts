/**
 * Search Console Sync Service
 *
 * Fetches Search Console data and syncs it to the database.
 * Handles query classification, branded keyword matching, and historical data.
 *
 * PERFORMANCE: Uses batch operations for 50-100x faster sync
 */

import { createClient } from '@/lib/supabase/server'

// Batch size for database operations
const BATCH_SIZE = 100

/**
 * Helper to process items in batches
 */
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const result = await processor(batch)
    results.push(result)
  }
  return results
}
import { SearchConsoleClient } from '@/seo/search-console/client'
import type {
  SearchConsoleQuery,
  SearchConsoleQueryRow,
  BrandedKeyword,
  BrandedKeywordRow,
  SyncResult,
  BUYER_KEYWORDS_NL,
  COMPARISON_KEYWORDS_NL,
  QUESTION_STARTERS_NL,
} from '@/types/search-console'

// Re-export classification keywords
export const BUYER_KEYWORDS = [
  'kopen',
  'bestellen',
  'prijs',
  'prijzen',
  'goedkoop',
  'goedkoopste',
  'beste',
  'aanbieding',
  'korting',
  'actie',
  'sale',
  'offerte',
  'kosten',
  'waar koop',
  'online bestellen',
]

export const COMPARISON_KEYWORDS = [
  'vs',
  'versus',
  'of',
  'verschil',
  'vergelijk',
  'vergelijken',
  'alternatief',
  'alternatieven',
  'beter dan',
  'review',
  'ervaring',
  'ervaringen',
]

export const QUESTION_STARTERS = [
  'wat',
  'waarom',
  'hoe',
  'wanneer',
  'waar',
  'wie',
  'welke',
  'hoeveel',
  'kan',
  'kun',
  'moet',
  'is het',
  'zijn er',
]

interface QueryClassification {
  isQuestion: boolean
  isBuyerKeyword: boolean
  isComparisonKeyword: boolean
}

interface SyncOptions {
  dateRangeDays?: number
  rowLimit?: number
  forceRefresh?: boolean
}

/**
 * Classify a query based on its content
 */
export function classifyQuery(query: string): QueryClassification {
  const lowerQuery = query.toLowerCase().trim()

  // Check if it's a question
  const isQuestion =
    lowerQuery.includes('?') ||
    QUESTION_STARTERS.some(starter => lowerQuery.startsWith(starter + ' '))

  // Check if it contains buyer intent keywords
  const isBuyerKeyword = BUYER_KEYWORDS.some(keyword =>
    lowerQuery.includes(keyword.toLowerCase())
  )

  // Check if it's a comparison query
  const isComparisonKeyword = COMPARISON_KEYWORDS.some(keyword =>
    lowerQuery.includes(keyword.toLowerCase())
  )

  return {
    isQuestion,
    isBuyerKeyword,
    isComparisonKeyword,
  }
}

/**
 * Check if a query matches any branded keywords
 */
export function isBrandedQuery(
  query: string,
  brandedKeywords: BrandedKeyword[]
): boolean {
  const lowerQuery = query.toLowerCase()

  return brandedKeywords.some(bk => {
    const lowerKeyword = bk.keyword.toLowerCase()

    switch (bk.matchType) {
      case 'exact':
        return lowerQuery === lowerKeyword
      case 'starts_with':
        return lowerQuery.startsWith(lowerKeyword)
      case 'contains':
      default:
        return lowerQuery.includes(lowerKeyword)
    }
  })
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get date range for sync
 */
function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 3) // SC data has 3-day delay

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days)

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  }
}

/**
 * Sync Search Console data for a client
 */
export async function syncSearchConsoleData(
  clientId: string,
  siteUrl: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { dateRangeDays = 28, rowLimit = 5000 } = options
  const errors: string[] = []
  let queriesProcessed = 0
  let queriesAdded = 0
  let queriesUpdated = 0
  let pagesProcessed = 0

  try {
    const supabase = await createClient()

    // Get Search Console client
    const scClient = SearchConsoleClient.fromEnv()

    // Get branded keywords for this client
    const { data: brandedKeywordsData } = await supabase
      .from('branded_keywords')
      .select('*')
      .eq('client_id', clientId)

    const brandedKeywords: BrandedKeyword[] = (brandedKeywordsData || []).map((row: BrandedKeywordRow) => ({
      id: row.id,
      clientId: row.client_id,
      keyword: row.keyword,
      matchType: row.match_type,
      createdAt: row.created_at,
    }))

    // Get date range
    const { startDate, endDate } = getDateRange(dateRangeDays)

    // Fetch queries from Search Console (site-level, not page-specific)
    const scQueries = await scClient.query({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit,
    })

    if (scQueries.length === 0) {
      return {
        success: true,
        queriesProcessed: 0,
        queriesAdded: 0,
        queriesUpdated: 0,
        pagesProcessed: 0,
        errors: [],
        syncedAt: new Date().toISOString(),
      }
    }

    // Group by query to aggregate across pages
    const queryMap = new Map<string, {
      impressions: number
      clicks: number
      bestPosition: number
      pages: { url: string; impressions: number; clicks: number; position: number; ctr: number }[]
    }>()

    for (const row of scQueries) {
      const existing = queryMap.get(row.query)

      if (existing) {
        existing.impressions += row.impressions
        existing.clicks += row.clicks
        existing.bestPosition = Math.min(existing.bestPosition, row.position)
        existing.pages.push({
          url: row.page,
          impressions: row.impressions,
          clicks: row.clicks,
          position: row.position,
          ctr: row.ctr,
        })
      } else {
        queryMap.set(row.query, {
          impressions: row.impressions,
          clicks: row.clicks,
          bestPosition: row.position,
          pages: [{
            url: row.page,
            impressions: row.impressions,
            clicks: row.clicks,
            position: row.position,
            ctr: row.ctr,
          }],
        })
      }
    }

    // PERFORMANCE: Batch process all queries instead of one-by-one
    // Step 1: Get all existing queries for this client in ONE query
    const queryTexts = Array.from(queryMap.keys())
    queriesProcessed = queryTexts.length

    const { data: existingQueries } = await supabase
      .from('search_console_queries')
      .select('id, query')
      .eq('client_id', clientId)
      .in('query', queryTexts)

    const existingQueryMap = new Map(
      (existingQueries || []).map(q => [q.query, q.id])
    )

    // Step 2: Prepare all records for batch operations
    const queriesToInsert: Array<{
      client_id: string
      query: string
      unique_impressions: number
      total_clicks: number
      best_position: number
      average_ctr: number
      page_count: number
      is_question: boolean
      is_buyer_keyword: boolean
      is_comparison_keyword: boolean
      is_branded: boolean
    }> = []

    const queriesToUpdate: Array<{
      id: string
      query: string
      unique_impressions: number
      total_clicks: number
      best_position: number
      average_ctr: number
      page_count: number
      is_question: boolean
      is_buyer_keyword: boolean
      is_comparison_keyword: boolean
      is_branded: boolean
      last_synced_at: string
    }> = []

    const queryToDataMap = new Map<string, typeof queryMap extends Map<string, infer V> ? V : never>()

    for (const [queryText, data] of queryMap) {
      const classification = classifyQuery(queryText)
      const isBranded = isBrandedQuery(queryText, brandedKeywords)
      const avgCtr = data.impressions > 0 ? data.clicks / data.impressions : 0

      queryToDataMap.set(queryText, data)

      const existingId = existingQueryMap.get(queryText)

      if (existingId) {
        queriesToUpdate.push({
          id: existingId,
          query: queryText,
          unique_impressions: data.impressions,
          total_clicks: data.clicks,
          best_position: data.bestPosition,
          average_ctr: avgCtr,
          page_count: data.pages.length,
          is_question: classification.isQuestion,
          is_buyer_keyword: classification.isBuyerKeyword,
          is_comparison_keyword: classification.isComparisonKeyword,
          is_branded: isBranded,
          last_synced_at: new Date().toISOString(),
        })
      } else {
        queriesToInsert.push({
          client_id: clientId,
          query: queryText,
          unique_impressions: data.impressions,
          total_clicks: data.clicks,
          best_position: data.bestPosition,
          average_ctr: avgCtr,
          page_count: data.pages.length,
          is_question: classification.isQuestion,
          is_buyer_keyword: classification.isBuyerKeyword,
          is_comparison_keyword: classification.isComparisonKeyword,
          is_branded: isBranded,
        })
      }
    }

    // Step 3: Batch insert new queries
    const insertedQueryIds = new Map<string, string>()
    if (queriesToInsert.length > 0) {
      await processBatch(queriesToInsert, BATCH_SIZE, async (batch) => {
        const { data: inserted, error } = await supabase
          .from('search_console_queries')
          .insert(batch)
          .select('id, query')

        if (error) {
          errors.push(`Batch insert failed: ${error.message}`)
        } else if (inserted) {
          for (const row of inserted) {
            insertedQueryIds.set(row.query, row.id)
          }
          queriesAdded += inserted.length
        }
      })
    }

    // Step 4: Batch update existing queries using upsert
    if (queriesToUpdate.length > 0) {
      await processBatch(queriesToUpdate, BATCH_SIZE, async (batch) => {
        // Use upsert with the id to update existing records
        const { error } = await supabase
          .from('search_console_queries')
          .upsert(batch.map(q => ({
            id: q.id,
            client_id: clientId,
            query: q.query,
            unique_impressions: q.unique_impressions,
            total_clicks: q.total_clicks,
            best_position: q.best_position,
            average_ctr: q.average_ctr,
            page_count: q.page_count,
            is_question: q.is_question,
            is_buyer_keyword: q.is_buyer_keyword,
            is_comparison_keyword: q.is_comparison_keyword,
            is_branded: q.is_branded,
            last_synced_at: q.last_synced_at,
          })), { onConflict: 'id' })

        if (error) {
          errors.push(`Batch update failed: ${error.message}`)
        } else {
          queriesUpdated += batch.length
        }
      })
    }

    // Step 5: Build complete query ID map
    const finalQueryIdMap = new Map<string, string>()
    for (const [query, id] of existingQueryMap) {
      finalQueryIdMap.set(query, id)
    }
    for (const [query, id] of insertedQueryIds) {
      finalQueryIdMap.set(query, id)
    }

    // Step 6: Batch upsert all pages
    const allPages: Array<{
      query_id: string
      page_url: string
      impressions: number
      clicks: number
      position: number
      ctr: number
    }> = []

    for (const [queryText, data] of queryToDataMap) {
      const queryId = finalQueryIdMap.get(queryText)
      if (!queryId) continue

      for (const page of data.pages) {
        allPages.push({
          query_id: queryId,
          page_url: page.url,
          impressions: page.impressions,
          clicks: page.clicks,
          position: page.position,
          ctr: page.ctr,
        })
      }
    }

    pagesProcessed = allPages.length

    if (allPages.length > 0) {
      await processBatch(allPages, BATCH_SIZE, async (batch) => {
        const { error } = await supabase
          .from('search_console_query_pages')
          .upsert(batch, { onConflict: 'query_id,page_url' })

        if (error) {
          errors.push(`Batch page upsert failed: ${error.message}`)
        }
      })
    }

    // Step 7: Batch upsert history
    const allHistory: Array<{
      query_id: string
      date_start: string
      date_end: string
      impressions: number
      clicks: number
      position: number
      ctr: number
    }> = []

    for (const [queryText, data] of queryToDataMap) {
      const queryId = finalQueryIdMap.get(queryText)
      if (!queryId) continue

      const avgCtr = data.impressions > 0 ? data.clicks / data.impressions : 0
      allHistory.push({
        query_id: queryId,
        date_start: startDate,
        date_end: endDate,
        impressions: data.impressions,
        clicks: data.clicks,
        position: data.bestPosition,
        ctr: avgCtr,
      })
    }

    if (allHistory.length > 0) {
      await processBatch(allHistory, BATCH_SIZE, async (batch) => {
        const { error } = await supabase
          .from('search_console_query_history')
          .upsert(batch, { onConflict: 'query_id,date_start,date_end' })

        if (error) {
          errors.push(`Batch history upsert failed: ${error.message}`)
        }
      })
    }

    return {
      success: errors.length === 0,
      queriesProcessed,
      queriesAdded,
      queriesUpdated,
      pagesProcessed,
      errors,
      syncedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      success: false,
      queriesProcessed,
      queriesAdded,
      queriesUpdated,
      pagesProcessed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      syncedAt: new Date().toISOString(),
    }
  }
}

/**
 * Update branded status for all queries when branded keywords change
 * PERFORMANCE: Uses batch updates instead of one-by-one
 */
export async function updateBrandedStatus(clientId: string): Promise<void> {
  const supabase = await createClient()

  // Get branded keywords
  const { data: brandedKeywordsData } = await supabase
    .from('branded_keywords')
    .select('*')
    .eq('client_id', clientId)

  const brandedKeywords: BrandedKeyword[] = (brandedKeywordsData || []).map((row: BrandedKeywordRow) => ({
    id: row.id,
    clientId: row.client_id,
    keyword: row.keyword,
    matchType: row.match_type,
    createdAt: row.created_at,
  }))

  // Get all queries for this client
  const { data: queries } = await supabase
    .from('search_console_queries')
    .select('id, query')
    .eq('client_id', clientId)

  if (!queries) return

  // PERFORMANCE: Group by branded status and batch update
  const brandedIds: string[] = []
  const nonBrandedIds: string[] = []

  for (const q of queries) {
    if (isBrandedQuery(q.query, brandedKeywords)) {
      brandedIds.push(q.id)
    } else {
      nonBrandedIds.push(q.id)
    }
  }

  // Batch update branded queries
  if (brandedIds.length > 0) {
    await processBatch(brandedIds, BATCH_SIZE, async (batch) => {
      await supabase
        .from('search_console_queries')
        .update({ is_branded: true })
        .in('id', batch)
    })
  }

  // Batch update non-branded queries
  if (nonBrandedIds.length > 0) {
    await processBatch(nonBrandedIds, BATCH_SIZE, async (batch) => {
      await supabase
        .from('search_console_queries')
        .update({ is_branded: false })
        .in('id', batch)
    })
  }
}

/**
 * Match queries to topic clusters
 * PERFORMANCE: Uses batch upserts instead of one-by-one
 */
export async function matchQueriesToClusters(clientId: string): Promise<void> {
  const supabase = await createClient()

  // Get all topic clusters for this client
  const { data: clusters } = await supabase
    .from('topic_clusters')
    .select('*')
    .eq('client_id', clientId)

  if (!clusters || clusters.length === 0) return

  // Get all queries for this client
  const { data: queries } = await supabase
    .from('search_console_queries')
    .select('id, query')
    .eq('client_id', clientId)

  if (!queries) return

  // PERFORMANCE: Collect all mappings first, then batch upsert
  const allMappings: Array<{
    cluster_id: string
    query_id: string
    matched_by: string
  }> = []

  // For each cluster, find matching queries
  for (const cluster of clusters) {
    for (const q of queries) {
      const lowerQuery = q.query.toLowerCase()

      // Check keyword matches
      const matchKeywords = cluster.match_keywords || []
      const keywordMatch = matchKeywords.some((kw: string) =>
        lowerQuery.includes(kw.toLowerCase())
      )

      if (keywordMatch) {
        allMappings.push({
          cluster_id: cluster.id,
          query_id: q.id,
          matched_by: 'keyword',
        })
        continue
      }

      // Check regex match
      if (cluster.match_regex) {
        try {
          const regex = new RegExp(cluster.match_regex, 'i')
          if (regex.test(q.query)) {
            allMappings.push({
              cluster_id: cluster.id,
              query_id: q.id,
              matched_by: 'regex',
            })
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
  }

  // Batch upsert all mappings
  if (allMappings.length > 0) {
    await processBatch(allMappings, BATCH_SIZE, async (batch) => {
      await supabase
        .from('topic_cluster_queries')
        .upsert(batch, { onConflict: 'cluster_id,query_id' })
    })
  }

  // Update cluster metrics (can be parallelized with Promise.all)
  await Promise.all(
    clusters.map(cluster =>
      supabase.rpc('update_topic_cluster_metrics', { p_cluster_id: cluster.id })
    )
  )
}

/**
 * Match pages to content groups
 * PERFORMANCE: Uses batch upserts instead of one-by-one
 */
export async function matchPagesToGroups(clientId: string): Promise<void> {
  const supabase = await createClient()

  console.log('🔍 matchPagesToGroups: Starting for client', clientId)

  // Get all content groups for this client
  const { data: groups } = await supabase
    .from('content_groups')
    .select('*')
    .eq('client_id', clientId)

  console.log('🔍 matchPagesToGroups: Found groups:', groups?.length, groups?.map(g => ({ name: g.name, patterns: g.url_patterns })))

  if (!groups || groups.length === 0) return

  // Get all page URLs for this client using a join through queries
  const { data: pages, error: pagesError } = await supabase
    .from('search_console_query_pages')
    .select(`
      page_url,
      impressions,
      clicks,
      search_console_queries!inner(client_id)
    `)
    .eq('search_console_queries.client_id', clientId)

  console.log('🔍 matchPagesToGroups: Found pages:', pages?.length, 'error:', pagesError?.message)

  if (!pages) return

  // Deduplicate pages and aggregate metrics
  const pageMap = new Map<string, { impressions: number; clicks: number }>()
  for (const p of pages) {
    const existing = pageMap.get(p.page_url)
    if (existing) {
      existing.impressions += p.impressions
      existing.clicks += p.clicks
    } else {
      pageMap.set(p.page_url, { impressions: p.impressions, clicks: p.clicks })
    }
  }

  console.log('🔍 matchPagesToGroups: Unique pages to match:', pageMap.size)

  // PERFORMANCE: Collect all mappings first, then batch upsert
  const allMappings: Array<{
    group_id: string
    page_url: string
    impressions: number
    clicks: number
    matched_by: string
  }> = []

  // For each group, find matching pages
  for (const group of groups) {
    for (const [url, metrics] of pageMap) {
      let urlPath: string
      try {
        urlPath = new URL(url).pathname
      } catch {
        continue // Skip invalid URLs
      }

      // Check URL pattern matches
      const urlPatterns = group.url_patterns || []
      const patternMatch = urlPatterns.some((pattern: string) => {
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        try {
          const regex = new RegExp(`^${regexPattern}$`)
          return regex.test(urlPath)
        } catch {
          return false
        }
      })

      if (patternMatch) {
        allMappings.push({
          group_id: group.id,
          page_url: url,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          matched_by: 'pattern',
        })
        continue
      }

      // Check regex match
      if (group.url_regex) {
        try {
          const regex = new RegExp(group.url_regex)
          if (regex.test(url) || regex.test(urlPath)) {
            allMappings.push({
              group_id: group.id,
              page_url: url,
              impressions: metrics.impressions,
              clicks: metrics.clicks,
              matched_by: 'regex',
            })
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
  }

  console.log('🔍 matchPagesToGroups: Total mappings to upsert:', allMappings.length)

  // Batch upsert all mappings
  if (allMappings.length > 0) {
    await processBatch(allMappings, BATCH_SIZE, async (batch) => {
      const { error } = await supabase
        .from('content_group_pages')
        .upsert(batch, { onConflict: 'group_id,page_url' })

      if (error) {
        console.error('🔍 matchPagesToGroups: Batch upsert error:', error)
      }
    })
  }

  // Update group metrics (parallelized with Promise.all)
  await Promise.all(
    groups.map(async (group) => {
      const { error: rpcError } = await supabase.rpc('update_content_group_metrics', { p_group_id: group.id })
      if (rpcError) {
        console.error('🔍 matchPagesToGroups: Error updating metrics for', group.name, rpcError)
      }
    })
  )
}
