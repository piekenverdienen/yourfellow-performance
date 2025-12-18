/**
 * Search Console Sync Service
 *
 * Fetches Search Console data and syncs it to the database.
 * Handles query classification, branded keyword matching, and historical data.
 */

import { createClient } from '@/lib/supabase/server'
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

    // Process each unique query
    for (const [queryText, data] of queryMap) {
      queriesProcessed++

      try {
        // Classify the query
        const classification = classifyQuery(queryText)
        const isBranded = isBrandedQuery(queryText, brandedKeywords)

        // Calculate average CTR
        const avgCtr = data.impressions > 0 ? data.clicks / data.impressions : 0

        // Check if query already exists
        const { data: existingQuery } = await supabase
          .from('search_console_queries')
          .select('id')
          .eq('client_id', clientId)
          .eq('query', queryText)
          .single()

        let queryId: string

        if (existingQuery) {
          // Update existing query
          const { data: updated, error: updateError } = await supabase
            .from('search_console_queries')
            .update({
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
            .eq('id', existingQuery.id)
            .select('id')
            .single()

          if (updateError) {
            errors.push(`Failed to update query "${queryText}": ${updateError.message}`)
            continue
          }

          queryId = updated!.id
          queriesUpdated++
        } else {
          // Insert new query
          const { data: inserted, error: insertError } = await supabase
            .from('search_console_queries')
            .insert({
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
            .select('id')
            .single()

          if (insertError) {
            errors.push(`Failed to insert query "${queryText}": ${insertError.message}`)
            continue
          }

          queryId = inserted!.id
          queriesAdded++
        }

        // Upsert query-page mappings
        for (const page of data.pages) {
          pagesProcessed++

          const { error: pageError } = await supabase
            .from('search_console_query_pages')
            .upsert({
              query_id: queryId,
              page_url: page.url,
              impressions: page.impressions,
              clicks: page.clicks,
              position: page.position,
              ctr: page.ctr,
            }, {
              onConflict: 'query_id,page_url',
            })

          if (pageError) {
            errors.push(`Failed to upsert page "${page.url}" for query "${queryText}": ${pageError.message}`)
          }
        }

        // Add historical data point
        const { error: historyError } = await supabase
          .from('search_console_query_history')
          .upsert({
            query_id: queryId,
            date_start: startDate,
            date_end: endDate,
            impressions: data.impressions,
            clicks: data.clicks,
            position: data.bestPosition,
            ctr: avgCtr,
          }, {
            onConflict: 'query_id,date_start,date_end',
          })

        if (historyError) {
          errors.push(`Failed to add history for query "${queryText}": ${historyError.message}`)
        }
      } catch (queryError) {
        errors.push(`Error processing query "${queryText}": ${queryError instanceof Error ? queryError.message : 'Unknown error'}`)
      }
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

  // Update branded status for each query
  for (const q of queries) {
    const isBranded = isBrandedQuery(q.query, brandedKeywords)

    await supabase
      .from('search_console_queries')
      .update({ is_branded: isBranded })
      .eq('id', q.id)
  }
}

/**
 * Match queries to topic clusters
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

  // For each cluster, find matching queries
  for (const cluster of clusters) {
    const matchingQueries: { queryId: string; matchedBy: string }[] = []

    for (const q of queries) {
      const lowerQuery = q.query.toLowerCase()

      // Check keyword matches
      const matchKeywords = cluster.match_keywords || []
      const keywordMatch = matchKeywords.some((kw: string) =>
        lowerQuery.includes(kw.toLowerCase())
      )

      if (keywordMatch) {
        matchingQueries.push({ queryId: q.id, matchedBy: 'keyword' })
        continue
      }

      // Check regex match
      if (cluster.match_regex) {
        try {
          const regex = new RegExp(cluster.match_regex, 'i')
          if (regex.test(q.query)) {
            matchingQueries.push({ queryId: q.id, matchedBy: 'regex' })
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    // Upsert cluster-query mappings
    for (const match of matchingQueries) {
      await supabase
        .from('topic_cluster_queries')
        .upsert({
          cluster_id: cluster.id,
          query_id: match.queryId,
          matched_by: match.matchedBy,
        }, {
          onConflict: 'cluster_id,query_id',
        })
    }

    // Update cluster metrics
    await supabase.rpc('update_topic_cluster_metrics', { p_cluster_id: cluster.id })
  }
}

/**
 * Match pages to content groups
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

  // Get query IDs first
  const { data: queryIds } = await supabase
    .from('search_console_queries')
    .select('id')
    .eq('client_id', clientId)

  console.log('🔍 matchPagesToGroups: Found query IDs:', queryIds?.length)

  if (!queryIds || queryIds.length === 0) return

  // Get all unique page URLs from query pages
  const { data: pages } = await supabase
    .from('search_console_query_pages')
    .select('page_url, impressions, clicks')
    .in('query_id', queryIds.map((q: { id: string }) => q.id))

  console.log('🔍 matchPagesToGroups: Found pages:', pages?.length)

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

  // For each group, find matching pages
  for (const group of groups) {
    const matchingPages: { url: string; impressions: number; clicks: number; matchedBy: string }[] = []

    for (const [url, metrics] of pageMap) {
      const urlPath = new URL(url).pathname

      // Check URL pattern matches
      const urlPatterns = group.url_patterns || []
      const patternMatch = urlPatterns.some((pattern: string) => {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        try {
          const regex = new RegExp(`^${regexPattern}$`)
          const matches = regex.test(urlPath)
          if (matches) {
            console.log('🔍 matchPagesToGroups: MATCH!', { pattern, urlPath, regex: regex.toString() })
          }
          return matches
        } catch {
          return false
        }
      })

      if (patternMatch) {
        matchingPages.push({ url, ...metrics, matchedBy: 'pattern' })
        continue
      }

      // Check regex match
      if (group.url_regex) {
        try {
          const regex = new RegExp(group.url_regex)
          if (regex.test(url) || regex.test(urlPath)) {
            matchingPages.push({ url, ...metrics, matchedBy: 'regex' })
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    console.log('🔍 matchPagesToGroups: Group', group.name, 'matched', matchingPages.length, 'pages')

    // Upsert group-page mappings
    for (const match of matchingPages) {
      const { error } = await supabase
        .from('content_group_pages')
        .upsert({
          group_id: group.id,
          page_url: match.url,
          impressions: match.impressions,
          clicks: match.clicks,
          matched_by: match.matchedBy,
        }, {
          onConflict: 'group_id,page_url',
        })
      if (error) {
        console.error('🔍 matchPagesToGroups: Error upserting page:', error)
      }
    }

    // Update group metrics
    const { error: rpcError } = await supabase.rpc('update_content_group_metrics', { p_group_id: group.id })
    if (rpcError) {
      console.error('🔍 matchPagesToGroups: Error updating metrics:', rpcError)
    }
  }
}
