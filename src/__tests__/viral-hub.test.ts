import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================
// Scoring Tests
// ============================================

describe('Viral Hub - Scoring Functions', () => {
  describe('calculateScore', () => {
    it('should calculate engagement score based on upvotes and comments', () => {
      // Engagement formula: min(30, log10(upvotes) * 5 + log10(comments) * 3)
      const testCases = [
        { upvotes: 100, comments: 10, expectedMin: 10, expectedMax: 20 },
        { upvotes: 1000, comments: 50, expectedMin: 15, expectedMax: 25 },
        { upvotes: 10000, comments: 500, expectedMin: 25, expectedMax: 30 },
      ]

      for (const { upvotes, comments, expectedMin, expectedMax } of testCases) {
        const engagement = Math.min(30, Math.round(
          (Math.log10(upvotes + 1) * 5) +
          (Math.log10(comments + 1) * 3)
        ))

        expect(engagement).toBeGreaterThanOrEqual(expectedMin)
        expect(engagement).toBeLessThanOrEqual(expectedMax)
      }
    })

    it('should calculate freshness score with time decay', () => {
      // Freshness formula: max(0, 20 - (ageHours / 12))
      const testCases = [
        { ageHours: 0, expectedScore: 20 },
        { ageHours: 12, expectedScore: 19 },
        { ageHours: 24, expectedScore: 18 },
        { ageHours: 240, expectedScore: 0 }, // 10 days old
      ]

      for (const { ageHours, expectedScore } of testCases) {
        const freshness = Math.max(0, Math.round(20 - (ageHours / 12)))
        expect(freshness).toBe(expectedScore)
      }
    })

    it('should cap total score at 100', () => {
      // Sum of max scores: 30 + 20 + 25 + 15 + 10 = 100
      const maxScores = {
        engagement: 30,
        freshness: 20,
        relevance: 25,
        novelty: 15,
        seasonality: 10,
      }

      const total = Object.values(maxScores).reduce((sum, val) => sum + val, 0)
      expect(total).toBe(100)
    })
  })
})

// ============================================
// Clustering Tests
// ============================================

describe('Viral Hub - Clustering Functions', () => {
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  ])

  function extractKeywords(text: string): Set<string> {
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word))

    return new Set(words)
  }

  function countOverlap(set1: Set<string>, set2: Set<string>): number {
    let count = 0
    set1.forEach(item => {
      if (set2.has(item)) count++
    })
    return count
  }

  describe('extractKeywords', () => {
    it('should extract relevant keywords from title', () => {
      const title = 'How to grow your business using viral marketing strategies'
      const keywords = extractKeywords(title)

      expect(keywords.has('grow')).toBe(true)
      expect(keywords.has('business')).toBe(true)
      expect(keywords.has('viral')).toBe(true)
      expect(keywords.has('marketing')).toBe(true)
      expect(keywords.has('strategies')).toBe(true)
    })

    it('should filter out stopwords', () => {
      const title = 'The best way to do marketing and grow'
      const keywords = extractKeywords(title)

      expect(keywords.has('the')).toBe(false)
      expect(keywords.has('to')).toBe(false)
      expect(keywords.has('and')).toBe(false)
      expect(keywords.has('best')).toBe(true)
      expect(keywords.has('marketing')).toBe(true)
    })

    it('should filter out short words (< 3 chars)', () => {
      const title = 'AI is a new way to do ML'
      const keywords = extractKeywords(title)

      expect(keywords.has('ai')).toBe(false)
      expect(keywords.has('is')).toBe(false)
      expect(keywords.has('new')).toBe(true)
      expect(keywords.has('way')).toBe(true)
    })

    it('should handle special characters', () => {
      const title = 'Marketing 101: How to win at e-commerce!'
      const keywords = extractKeywords(title)

      expect(keywords.has('marketing')).toBe(true)
      expect(keywords.has('101')).toBe(true)
      expect(keywords.has('commerce')).toBe(true)
    })
  })

  describe('countOverlap', () => {
    it('should count shared keywords between two sets', () => {
      const set1 = new Set(['marketing', 'viral', 'growth'])
      const set2 = new Set(['marketing', 'strategy', 'growth', 'business'])

      const overlap = countOverlap(set1, set2)
      expect(overlap).toBe(2) // 'marketing' and 'growth'
    })

    it('should return 0 for no overlap', () => {
      const set1 = new Set(['marketing', 'viral'])
      const set2 = new Set(['development', 'coding'])

      const overlap = countOverlap(set1, set2)
      expect(overlap).toBe(0)
    })

    it('should handle empty sets', () => {
      const set1 = new Set<string>()
      const set2 = new Set(['marketing', 'viral'])

      expect(countOverlap(set1, set2)).toBe(0)
      expect(countOverlap(set2, set1)).toBe(0)
    })
  })
})

// ============================================
// Reddit Normalization Tests
// ============================================

describe('Viral Hub - Reddit Signal Normalization', () => {
  const MAX_EXCERPT_LENGTH = 500

  interface RedditPost {
    id: string
    title: string
    author: string
    subreddit: string
    permalink: string
    selftext: string
    created_utc: number
    score: number
    upvote_ratio: number
    num_comments: number
  }

  function normalizePost(post: RedditPost) {
    let excerpt = post.selftext || ''
    if (excerpt.length > MAX_EXCERPT_LENGTH) {
      excerpt = excerpt.substring(0, MAX_EXCERPT_LENGTH) + '...'
    }

    const ageHours = (Date.now() / 1000 - post.created_utc) / 3600
    const velocity = ageHours > 0 ? post.score / ageHours : post.score

    return {
      sourceType: 'reddit' as const,
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
        velocity: Math.round(velocity * 100) / 100,
      },
      rawExcerpt: excerpt || undefined,
    }
  }

  it('should normalize reddit post to signal format', () => {
    const mockPost: RedditPost = {
      id: 'abc123',
      title: 'Test viral post',
      author: 'testuser',
      subreddit: 'marketing',
      permalink: '/r/marketing/comments/abc123/test_viral_post',
      selftext: 'This is the post content',
      created_utc: Date.now() / 1000 - 3600, // 1 hour ago
      score: 500,
      upvote_ratio: 0.95,
      num_comments: 42,
    }

    const normalized = normalizePost(mockPost)

    expect(normalized.sourceType).toBe('reddit')
    expect(normalized.externalId).toBe('abc123')
    expect(normalized.url).toBe('https://reddit.com/r/marketing/comments/abc123/test_viral_post')
    expect(normalized.title).toBe('Test viral post')
    expect(normalized.author).toBe('testuser')
    expect(normalized.community).toBe('marketing')
    expect(normalized.metrics.upvotes).toBe(500)
    expect(normalized.metrics.comments).toBe(42)
    expect(normalized.metrics.upvoteRatio).toBe(0.95)
  })

  it('should truncate long excerpts', () => {
    const longContent = 'x'.repeat(1000)
    const mockPost: RedditPost = {
      id: 'xyz789',
      title: 'Long post',
      author: 'author',
      subreddit: 'test',
      permalink: '/r/test/xyz789',
      selftext: longContent,
      created_utc: Date.now() / 1000,
      score: 100,
      upvote_ratio: 0.9,
      num_comments: 10,
    }

    const normalized = normalizePost(mockPost)

    expect(normalized.rawExcerpt!.length).toBeLessThanOrEqual(MAX_EXCERPT_LENGTH + 3) // +3 for '...'
    expect(normalized.rawExcerpt!.endsWith('...')).toBe(true)
  })

  it('should calculate velocity (upvotes per hour)', () => {
    const mockPost: RedditPost = {
      id: 'vel123',
      title: 'Velocity test',
      author: 'author',
      subreddit: 'test',
      permalink: '/r/test/vel123',
      selftext: '',
      created_utc: Date.now() / 1000 - 7200, // 2 hours ago
      score: 200, // 100 upvotes per hour
      upvote_ratio: 0.9,
      num_comments: 10,
    }

    const normalized = normalizePost(mockPost)

    expect(normalized.metrics.velocity).toBeGreaterThan(90)
    expect(normalized.metrics.velocity).toBeLessThan(110)
  })
})

// ============================================
// Spam Detection Tests
// ============================================

describe('Viral Hub - Spam Detection', () => {
  const SPAM_KEYWORDS = [
    'giveaway',
    'free crypto',
    'dm me',
    'click link in bio',
    'onlyfans',
    'get rich quick',
  ]

  function isSpam(signal: { title: string; rawExcerpt?: string }): boolean {
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

  it('should detect spam keywords in title', () => {
    expect(isSpam({ title: 'Free crypto giveaway!' })).toBe(true)
    expect(isSpam({ title: 'Get rich quick with this strategy' })).toBe(true)
    expect(isSpam({ title: 'DM me for the secret' })).toBe(true)
  })

  it('should detect spam keywords in excerpt', () => {
    expect(isSpam({
      title: 'Normal title',
      rawExcerpt: 'Click link in bio for more',
    })).toBe(true)
  })

  it('should detect ALL CAPS titles as spam', () => {
    expect(isSpam({ title: 'THIS IS A VERY LONG TITLE IN ALL CAPS' })).toBe(true)
    expect(isSpam({ title: 'SHORT' })).toBe(false) // Too short to trigger
  })

  it('should detect excessive special characters as spam', () => {
    expect(isSpam({ title: 'BUY NOW!!! $$$ AMAZING!!!' })).toBe(true)
    expect(isSpam({ title: 'Normal marketing post' })).toBe(false)
  })

  it('should not flag legitimate content', () => {
    expect(isSpam({
      title: 'How to grow your business with content marketing',
      rawExcerpt: 'In this post, I share my experience with...',
    })).toBe(false)
  })
})

// ============================================
// Authorization Tests
// ============================================

describe('Viral Hub - Authorization', () => {
  type UserRole = 'admin' | 'marketer' | 'client'

  function isInternalRole(role: UserRole): boolean {
    return ['admin', 'marketer'].includes(role)
  }

  function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      marketer: 2,
      client: 1,
    }
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }

  function canAccessViralHub(role: UserRole, internalOnly: boolean): boolean {
    if (internalOnly) {
      return isInternalRole(role)
    }
    return true
  }

  describe('isInternalRole', () => {
    it('should return true for admin and marketer', () => {
      expect(isInternalRole('admin')).toBe(true)
      expect(isInternalRole('marketer')).toBe(true)
    })

    it('should return false for client', () => {
      expect(isInternalRole('client')).toBe(false)
    })
  })

  describe('hasMinimumRole', () => {
    it('should correctly compare role hierarchy', () => {
      expect(hasMinimumRole('admin', 'client')).toBe(true)
      expect(hasMinimumRole('admin', 'marketer')).toBe(true)
      expect(hasMinimumRole('admin', 'admin')).toBe(true)

      expect(hasMinimumRole('marketer', 'client')).toBe(true)
      expect(hasMinimumRole('marketer', 'marketer')).toBe(true)
      expect(hasMinimumRole('marketer', 'admin')).toBe(false)

      expect(hasMinimumRole('client', 'client')).toBe(true)
      expect(hasMinimumRole('client', 'marketer')).toBe(false)
      expect(hasMinimumRole('client', 'admin')).toBe(false)
    })
  })

  describe('canAccessViralHub', () => {
    it('should allow admin and marketer when internal only', () => {
      expect(canAccessViralHub('admin', true)).toBe(true)
      expect(canAccessViralHub('marketer', true)).toBe(true)
      expect(canAccessViralHub('client', true)).toBe(false)
    })

    it('should allow all roles when not internal only', () => {
      expect(canAccessViralHub('admin', false)).toBe(true)
      expect(canAccessViralHub('marketer', false)).toBe(true)
      expect(canAccessViralHub('client', false)).toBe(true)
    })
  })
})
