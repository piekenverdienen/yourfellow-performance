/**
 * Ahrefs API Client
 *
 * Fetches keyword research data from Ahrefs API v3.
 * - Search volume
 * - Keyword difficulty
 * - CPC
 * - SERP features
 *
 * Note: Ahrefs API v3 requires Enterprise plan.
 * Free testing available for ahrefs.com and wordcount.com targets.
 */

export interface AhrefsKeywordData {
  keyword: string
  volume: number           // Monthly search volume
  difficulty: number       // Keyword Difficulty (0-100)
  cpc: number | null       // Cost per click in USD
  clicks: number | null    // Estimated clicks (not all searches result in clicks)
  globalVolume: number | null  // Global search volume
  parentTopic?: string     // Parent topic cluster
  updatedAt: string        // When data was last updated
}

export interface AhrefsKeywordsResponse {
  keywords: AhrefsKeywordData[]
  country: string
  fetchedAt: Date
}

export interface AhrefsClientOptions {
  apiToken: string
  defaultCountry?: string  // ISO country code, default 'nl'
}

interface AhrefsAPIError {
  error: {
    message: string
    code: string
  }
}

interface AhrefsKeywordOverviewResponse {
  keywords: Array<{
    keyword: string
    volume: number
    keyword_difficulty: number
    cpc: number | null
    clicks: number | null
    global_volume: number | null
    parent_topic?: string
    updated_at: string
  }>
}

/**
 * Ahrefs API v3 Client
 */
export class AhrefsClient {
  private apiToken: string
  private defaultCountry: string
  private baseUrl = 'https://api.ahrefs.com/v3'

  constructor(options: AhrefsClientOptions) {
    this.apiToken = options.apiToken
    this.defaultCountry = options.defaultCountry || 'nl'
  }

  /**
   * Create client from environment variable
   */
  static fromEnv(): AhrefsClient | null {
    const apiToken = process.env.AHREFS_API_TOKEN

    if (!apiToken) {
      console.warn('[Ahrefs] No AHREFS_API_TOKEN found - keyword data will not be available')
      return null
    }

    return new AhrefsClient({ apiToken })
  }

  /**
   * Get keyword data for multiple keywords
   */
  async getKeywordData(
    keywords: string[],
    options: {
      country?: string
    } = {}
  ): Promise<AhrefsKeywordsResponse> {
    const country = options.country || this.defaultCountry

    // Ahrefs API accepts up to 100 keywords per request
    const batchSize = 100
    const allKeywordData: AhrefsKeywordData[] = []

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize)
      const batchData = await this.fetchKeywordBatch(batch, country)
      allKeywordData.push(...batchData)
    }

    return {
      keywords: allKeywordData,
      country,
      fetchedAt: new Date(),
    }
  }

  /**
   * Fetch a batch of keywords from Ahrefs API
   */
  private async fetchKeywordBatch(
    keywords: string[],
    country: string
  ): Promise<AhrefsKeywordData[]> {
    const url = `${this.baseUrl}/keywords-explorer/overview`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        country,
        select: [
          'keyword',
          'volume',
          'keyword_difficulty',
          'cpc',
          'clicks',
          'global_volume',
          'parent_topic',
          'updated_at',
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Ahrefs API error: ${response.status}`

      try {
        const errorJson: AhrefsAPIError = JSON.parse(errorText)
        errorMessage = `Ahrefs API error: ${errorJson.error.message} (${errorJson.error.code})`
      } catch {
        errorMessage = `Ahrefs API error: ${response.status} - ${errorText}`
      }

      throw new Error(errorMessage)
    }

    const data: AhrefsKeywordOverviewResponse = await response.json()

    return data.keywords.map((kw) => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.keyword_difficulty,
      cpc: kw.cpc,
      clicks: kw.clicks,
      globalVolume: kw.global_volume,
      parentTopic: kw.parent_topic,
      updatedAt: kw.updated_at,
    }))
  }

  /**
   * Get single keyword data
   */
  async getSingleKeyword(
    keyword: string,
    options: { country?: string } = {}
  ): Promise<AhrefsKeywordData | null> {
    const response = await this.getKeywordData([keyword], options)
    return response.keywords[0] || null
  }

  /**
   * Categorize demand level based on search volume
   *
   * Thresholds (adjustable per niche):
   * - high: > 1000 monthly searches
   * - medium: 100-1000 monthly searches
   * - low: 10-100 monthly searches
   * - none: < 10 monthly searches
   */
  static categorizeDemand(
    volume: number,
    thresholds: { high: number; medium: number; low: number } = {
      high: 1000,
      medium: 100,
      low: 10,
    }
  ): 'high' | 'medium' | 'low' | 'none' {
    if (volume >= thresholds.high) return 'high'
    if (volume >= thresholds.medium) return 'medium'
    if (volume >= thresholds.low) return 'low'
    return 'none'
  }

  /**
   * Categorize competition based on keyword difficulty
   *
   * Ahrefs KD scale:
   * - 0-10: Easy
   * - 11-30: Medium
   * - 31-50: Hard
   * - 51-70: Very Hard
   * - 71-100: Super Hard
   */
  static categorizeCompetition(difficulty: number): 'easy' | 'medium' | 'hard' | 'very_hard' {
    if (difficulty <= 10) return 'easy'
    if (difficulty <= 30) return 'medium'
    if (difficulty <= 50) return 'hard'
    return 'very_hard'
  }

  /**
   * Calculate opportunity score based on volume and difficulty
   * Higher score = better opportunity (high volume, low difficulty)
   */
  static calculateOpportunityScore(volume: number, difficulty: number): number {
    if (volume === 0) return 0

    // Normalize difficulty (invert: lower difficulty = higher score)
    const difficultyScore = (100 - difficulty) / 100

    // Log scale for volume (to prevent huge volumes from dominating)
    const volumeScore = Math.log10(Math.max(volume, 1)) / 5 // Normalize to ~0-1 for volumes up to 100k

    // Combined score (weighted: 60% volume, 40% difficulty)
    return Math.round((volumeScore * 0.6 + difficultyScore * 0.4) * 100)
  }
}

export { AhrefsClient as default }
