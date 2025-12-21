/**
 * Simple in-memory cache for API responses
 *
 * For 15 daily users, in-memory caching is sufficient.
 * Upgrade to Redis/Upstash when scaling to 100+ concurrent users.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  /**
   * Get cached data or fetch fresh data
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const now = Date.now()
    const cached = this.cache.get(key) as CacheEntry<T> | undefined

    if (cached && cached.expiresAt > now) {
      return cached.data
    }

    // Fetch fresh data
    const data = await fetcher()

    // Store in cache
    this.cache.set(key, {
      data,
      expiresAt: now + (ttlSeconds * 1000),
    })

    return data
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    Array.from(this.cache.keys()).forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Singleton instance
export const cache = new SimpleCache()

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  LEADERBOARD: 5 * 60,      // 5 minutes - doesn't change often
  CLIENT_LIST: 60,           // 1 minute - changes occasionally
  OPPORTUNITIES: 2 * 60,     // 2 minutes - regenerated periodically
  PROFILE: 30,               // 30 seconds - user-specific
  STATS: 60,                 // 1 minute - dashboard stats
} as const
