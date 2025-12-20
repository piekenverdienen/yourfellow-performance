/**
 * Viral Signal Ingestion Service
 *
 * Orchestrates fetching signals from sources and storing them in the database.
 * Handles deduplication, normalization, and basic spam filtering.
 */

import { createClient } from '@/lib/supabase/server'
import { getProvider, type NormalizedSignal, type ViralSourceType } from './sources'

// ============================================
// Types
// ============================================

export interface IngestConfig {
  industry: string
  reddit?: {
    subreddits?: string[]
    query?: string
    sort?: 'hot' | 'top' | 'new' | 'rising'
    timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
    limit?: number
  }
  // Future: youtube, tiktok configs
}

export interface IngestResult {
  success: boolean
  inserted: number
  updated: number
  skipped: number
  errors: string[]
  signals: IngestedSignal[]
}

export interface IngestedSignal {
  id: string
  sourceType: ViralSourceType
  externalId: string
  title: string
  url: string
}

// ============================================
// Constants
// ============================================

const CACHE_HOURS = 6  // Don't re-fetch same post within this window
const MAX_TITLE_LENGTH = 500
const SPAM_KEYWORDS = [
  'giveaway',
  'free crypto',
  'dm me',
  'click link in bio',
  'onlyfans',
  'get rich quick',
]

// ============================================
// Main Ingestion Function
// ============================================

export async function ingestSignals(config: IngestConfig): Promise<IngestResult> {
  const result: IngestResult = {
    success: true,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    signals: [],
  }

  // Collect all signals from sources
  const allSignals: NormalizedSignal[] = []

  // Reddit
  if (config.reddit) {
    try {
      const redditProvider = getProvider('reddit')
      if (redditProvider && redditProvider.isAvailable()) {
        const signals = await redditProvider.fetchSignals({
          industry: config.industry,
          subreddits: config.reddit.subreddits,
          query: config.reddit.query,
          sort: config.reddit.sort || 'hot',
          timeFilter: config.reddit.timeFilter || 'day',
          limit: config.reddit.limit || 25,
        })
        allSignals.push(...signals)
      }
    } catch (error) {
      result.errors.push(`Reddit error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  // Filter out spam
  const filteredSignals = allSignals.filter(signal => !isSpam(signal))

  // Store signals
  const supabase = await createClient()

  for (const signal of filteredSignals) {
    try {
      const stored = await storeSignal(supabase, signal, config.industry)

      if (stored.inserted) {
        result.inserted++
        result.signals.push({
          id: stored.id,
          sourceType: signal.sourceType,
          externalId: signal.externalId,
          title: signal.title,
          url: signal.url,
        })
      } else if (stored.updated) {
        result.updated++
      } else {
        result.skipped++
      }
    } catch (error) {
      result.errors.push(`Store error for ${signal.externalId}: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  if (result.errors.length > 0 && result.inserted === 0 && result.updated === 0) {
    result.success = false
  }

  return result
}

// ============================================
// Storage Logic
// ============================================

interface StoreResult {
  id: string
  inserted: boolean
  updated: boolean
}

async function storeSignal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  signal: NormalizedSignal,
  industry: string
): Promise<StoreResult> {
  // Check for existing signal
  const { data: existing } = await supabase
    .from('viral_signals')
    .select('id, fetched_at, metrics')
    .eq('source_type', signal.sourceType)
    .eq('external_id', signal.externalId)
    .single()

  if (existing) {
    // Check if we should update (cache window)
    const fetchedAt = new Date(existing.fetched_at)
    const hoursSinceFetch = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceFetch < CACHE_HOURS) {
      // Skip, too recent
      return { id: existing.id, inserted: false, updated: false }
    }

    // Update metrics
    const { error } = await supabase
      .from('viral_signals')
      .update({
        metrics: signal.metrics,
        fetched_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw error

    return { id: existing.id, inserted: false, updated: true }
  }

  // Insert new signal
  const { data: inserted, error } = await supabase
    .from('viral_signals')
    .insert({
      source_type: signal.sourceType,
      external_id: signal.externalId,
      url: signal.url,
      title: signal.title.substring(0, MAX_TITLE_LENGTH),
      author: signal.author,
      community: signal.community,
      created_at_external: signal.createdAtExternal?.toISOString(),
      metrics: signal.metrics,
      raw_excerpt: signal.rawExcerpt,
      industry,
      is_processed: false,
    })
    .select('id')
    .single()

  if (error) throw error

  return { id: inserted.id, inserted: true, updated: false }
}

// ============================================
// Spam Detection
// ============================================

function isSpam(signal: NormalizedSignal): boolean {
  const titleLower = signal.title.toLowerCase()
  const excerptLower = (signal.rawExcerpt || '').toLowerCase()
  const combined = titleLower + ' ' + excerptLower

  // Check for spam keywords
  for (const keyword of SPAM_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true
    }
  }

  // All caps title (shouting)
  if (signal.title === signal.title.toUpperCase() && signal.title.length > 20) {
    return true
  }

  // Too many special characters
  const specialCharRatio = (signal.title.match(/[!?$%&*]/g) || []).length / signal.title.length
  if (specialCharRatio > 0.15) {
    return true
  }

  return false
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get recent signals for an industry
 */
export async function getRecentSignals(
  industry: string,
  days = 7,
  limit = 100
): Promise<NormalizedSignal[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('viral_signals')
    .select('*')
    .eq('industry', industry)
    .gte('fetched_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []).map(row => ({
    sourceType: row.source_type as ViralSourceType,
    externalId: row.external_id,
    url: row.url,
    title: row.title,
    author: row.author,
    community: row.community,
    createdAtExternal: row.created_at_external ? new Date(row.created_at_external) : undefined,
    metrics: row.metrics as NormalizedSignal['metrics'],
    rawExcerpt: row.raw_excerpt,
    industry: row.industry,
  }))
}

/**
 * Mark signals as processed
 */
export async function markSignalsProcessed(signalIds: string[]): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('viral_signals')
    .update({ is_processed: true })
    .in('id', signalIds)

  if (error) throw error
}
