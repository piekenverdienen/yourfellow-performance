/**
 * Reddit Signal Source
 *
 * Fetches trending posts from Reddit using public JSON endpoints.
 * No API key required for public subreddit data.
 */

import type {
  SignalSourceProvider,
  NormalizedSignal,
  FetchConfig,
  RedditListing,
  RedditPost,
} from './types'

// ============================================
// Constants
// ============================================

const REDDIT_BASE_URL = 'https://www.reddit.com'
const USER_AGENT = 'YourFellow-Performance/1.0 (Trend Discovery Bot)'
const MAX_EXCERPT_LENGTH = 500
const REQUEST_DELAY_MS = 1000  // Rate limiting: 1 request per second
const MAX_RETRIES = 3

// ============================================
// Reddit Provider Implementation
// ============================================

export class RedditProvider implements SignalSourceProvider {
  type = 'reddit' as const
  name = 'Reddit'

  private lastRequestTime = 0

  isAvailable(): boolean {
    return true  // Public endpoints, no API key needed
  }

  async fetchSignals(config: FetchConfig): Promise<NormalizedSignal[]> {
    const signals: NormalizedSignal[] = []
    const subreddits = config.subreddits || ['all']
    const sort = config.sort || 'hot'
    const timeFilter = config.timeFilter || 'day'
    const limit = Math.min(config.limit || 25, 100)

    console.log('[Reddit] Starting fetch with config:', {
      subreddits,
      sort,
      timeFilter,
      limit,
      query: config.query,
    })

    for (const subreddit of subreddits) {
      try {
        // Rate limiting
        await this.respectRateLimit()

        console.log(`[Reddit] Fetching r/${subreddit}...`)
        const posts = await this.fetchSubreddit(subreddit, sort, timeFilter, limit)
        console.log(`[Reddit] Received ${posts.length} posts from r/${subreddit}`)

        let added = 0
        let skipped = 0
        for (const post of posts) {
          // Skip stickied posts, removed content, etc.
          if (this.shouldSkipPost(post)) {
            skipped++
            continue
          }

          signals.push(this.normalizePost(post, config.industry))
          added++
        }
        console.log(`[Reddit] r/${subreddit}: added ${added}, skipped ${skipped}`)
      } catch (error) {
        console.error(`[Reddit] Error fetching r/${subreddit}:`, error)
        // Continue with other subreddits
      }
    }

    // If a search query is provided, also search
    if (config.query) {
      try {
        await this.respectRateLimit()
        console.log(`[Reddit] Searching for: ${config.query}`)
        const searchPosts = await this.searchReddit(config.query, sort, timeFilter, limit)
        console.log(`[Reddit] Search returned ${searchPosts.length} posts`)

        let added = 0
        for (const post of searchPosts) {
          if (this.shouldSkipPost(post)) continue

          // Avoid duplicates
          const exists = signals.some(s => s.externalId === post.id)
          if (!exists) {
            signals.push(this.normalizePost(post, config.industry))
            added++
          }
        }
        console.log(`[Reddit] Added ${added} from search`)
      } catch (error) {
        console.error('[Reddit] Error searching:', error)
      }
    }

    console.log(`[Reddit] Total signals: ${signals.length}`)
    return signals
  }

  // ============================================
  // Private Methods
  // ============================================

  private async fetchSubreddit(
    subreddit: string,
    sort: string,
    timeFilter: string,
    limit: number
  ): Promise<RedditPost[]> {
    const url = new URL(`${REDDIT_BASE_URL}/r/${subreddit}/${sort}.json`)
    url.searchParams.set('limit', String(limit))
    if (sort === 'top') {
      url.searchParams.set('t', timeFilter)
    }
    url.searchParams.set('raw_json', '1')

    return this.fetchWithRetry(url.toString())
  }

  private async searchReddit(
    query: string,
    sort: string,
    timeFilter: string,
    limit: number
  ): Promise<RedditPost[]> {
    const url = new URL(`${REDDIT_BASE_URL}/search.json`)
    url.searchParams.set('q', query)
    url.searchParams.set('sort', sort === 'hot' ? 'relevance' : sort)
    url.searchParams.set('t', timeFilter)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('raw_json', '1')

    return this.fetchWithRetry(url.toString())
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<RedditPost[]> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      })

      if (response.status === 429) {
        // Rate limited - wait and retry
        if (attempt < MAX_RETRIES) {
          const waitTime = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return this.fetchWithRetry(url, attempt + 1)
        }
        throw new Error('Rate limited by Reddit')
      }

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`)
      }

      const data: RedditListing = await response.json()
      return data.data.children.map(child => child.data)
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw error
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, REQUEST_DELAY_MS - timeSinceLastRequest)
      )
    }

    this.lastRequestTime = Date.now()
  }

  private shouldSkipPost(post: RedditPost): boolean {
    // Skip removed/deleted content
    if (post.selftext === '[removed]' || post.selftext === '[deleted]') return true
    if (post.author === '[deleted]') return true

    // Skip very low engagement posts
    if (post.score < 10) return true

    // Skip posts with very low upvote ratio (controversial/spam)
    if (post.upvote_ratio < 0.5) return true

    return false
  }

  private normalizePost(post: RedditPost, industry?: string): NormalizedSignal {
    // Truncate selftext for compliance
    let excerpt = post.selftext || ''
    if (excerpt.length > MAX_EXCERPT_LENGTH) {
      excerpt = excerpt.substring(0, MAX_EXCERPT_LENGTH) + '...'
    }

    // Calculate velocity (upvotes per hour since creation)
    const ageHours = (Date.now() / 1000 - post.created_utc) / 3600
    const velocity = ageHours > 0 ? post.score / ageHours : post.score

    return {
      sourceType: 'reddit',
      externalId: post.id,
      url: `https://reddit.com${post.permalink}`,
      title: post.title,
      author: post.author,
      community: post.subreddit,
      createdAtExternal: new Date(post.created_utc * 1000),
      metrics: {
        upvotes: post.score,
        comments: post.num_comments,
        upvoteRatio: post.upvote_ratio,
        awards: post.total_awards_received || 0,
        velocity: Math.round(velocity * 100) / 100,
      },
      rawExcerpt: excerpt || undefined,
      industry,
    }
  }
}

// ============================================
// Singleton Export
// ============================================

let redditProviderInstance: RedditProvider | null = null

export function getRedditProvider(): RedditProvider {
  if (!redditProviderInstance) {
    redditProviderInstance = new RedditProvider()
  }
  return redditProviderInstance
}
