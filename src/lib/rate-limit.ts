/**
 * Simple in-memory rate limiter
 *
 * Beschermt API tegen overbelasting:
 * - Max X requests per tijdseenheid per IP/user
 * - Automatische cleanup van oude entries
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>()

  // Cleanup every 5 minutes
  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * Check if request is allowed
   * @returns { allowed: boolean, remaining: number, resetIn: number }
   */
  check(
    key: string,
    maxRequests: number = 100,
    windowMs: number = 60 * 1000 // 1 minute default
  ): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now()
    const entry = this.limits.get(key)

    // No entry or expired - create new
    if (!entry || entry.resetAt < now) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetIn: windowMs,
      }
    }

    // Check limit
    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetAt - now,
      }
    }

    // Increment and allow
    entry.count++
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetIn: entry.resetAt - now,
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    Array.from(this.limits.entries()).forEach(([key, entry]) => {
      if (entry.resetAt < now) {
        this.limits.delete(key)
      }
    })
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

// Preset configurations for different endpoints
export const RATE_LIMITS = {
  // Standard API: 100 requests per minute
  API: { maxRequests: 100, windowMs: 60 * 1000 },

  // Auth endpoints: 10 per minute (prevent brute force)
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 },

  // AI generation: 20 per minute (expensive operations)
  AI_GENERATE: { maxRequests: 20, windowMs: 60 * 1000 },

  // Heavy operations: 5 per minute
  HEAVY: { maxRequests: 5, windowMs: 60 * 1000 },
} as const

/**
 * Helper to get client identifier for rate limiting
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'

  return `ip:${ip}`
}

/**
 * Create rate limit response with proper headers
 */
export function createRateLimitResponse(resetIn: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Te veel requests. Probeer het over enkele seconden opnieuw.',
      retryAfter: Math.ceil(resetIn / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}
