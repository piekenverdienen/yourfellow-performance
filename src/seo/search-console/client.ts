/**
 * Google Search Console API Client
 *
 * Fetches search performance data grouped by query and page.
 * Uses service account authentication (same pattern as GA4).
 */

import type { SearchConsoleQuery, SearchConsoleDataset, SearchConsoleFilters } from '../types'

interface ServiceAccountCredentials {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
}

interface SearchConsoleClientOptions {
  credentials: ServiceAccountCredentials
  timezone?: string
}

interface SearchAnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[]
  responseAggregationType?: string
}

/**
 * Google Search Console API Client
 */
export class SearchConsoleClient {
  private credentials: ServiceAccountCredentials
  private timezone: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(options: SearchConsoleClientOptions) {
    this.credentials = options.credentials
    this.timezone = options.timezone || 'Europe/Amsterdam'
  }

  /**
   * Create client from environment variable
   */
  static fromEnv(): SearchConsoleClient {
    const credentialsJson = process.env.SEARCH_CONSOLE_CREDENTIALS || process.env.GA4_CREDENTIALS

    if (!credentialsJson) {
      throw new Error(
        'Missing SEARCH_CONSOLE_CREDENTIALS or GA4_CREDENTIALS environment variable. ' +
          'These should contain the full JSON service account key.'
      )
    }

    let credentials: ServiceAccountCredentials
    try {
      credentials = JSON.parse(credentialsJson)
    } catch {
      throw new Error('Invalid JSON in SEARCH_CONSOLE_CREDENTIALS/GA4_CREDENTIALS')
    }

    return new SearchConsoleClient({ credentials })
  }

  /**
   * Get OAuth2 access token using service account
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken
    }

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const jwt = await this.signJWT(header, payload)

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get access token: ${error}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000

    return this.accessToken!
  }

  /**
   * Sign JWT with RS256
   */
  private async signJWT(
    header: Record<string, string>,
    payload: Record<string, string | number>
  ): Promise<string> {
    const encoder = new TextEncoder()

    const headerB64 = this.base64urlEncode(JSON.stringify(header))
    const payloadB64 = this.base64urlEncode(JSON.stringify(payload))
    const signatureInput = `${headerB64}.${payloadB64}`

    // Import private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(this.credentials.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Sign
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      encoder.encode(signatureInput)
    )

    const signatureB64 = this.base64urlEncode(signature)

    return `${signatureInput}.${signatureB64}`
  }

  /**
   * Convert PEM to ArrayBuffer
   */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')

    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Base64url encode
   */
  private base64urlEncode(input: string | ArrayBuffer): string {
    let b64: string

    if (typeof input === 'string') {
      b64 = btoa(input)
    } else {
      const bytes = new Uint8Array(input)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      b64 = btoa(binary)
    }

    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /**
   * Query Search Console API
   */
  async query(filters: SearchConsoleFilters): Promise<SearchConsoleQuery[]> {
    const token = await this.getAccessToken()

    // Normalize site URL format
    const siteUrl = this.normalizeSiteUrl(filters.siteUrl)

    const requestBody: Record<string, unknown> = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      dimensions: filters.dimensions || ['query', 'page'],
      rowLimit: filters.rowLimit || 1000,
      startRow: filters.startRow || 0,
    }

    // Add page filter if specified
    if (filters.pageUrl) {
      requestBody.dimensionFilterGroups = [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'equals',
              expression: filters.pageUrl,
            },
          ],
        },
      ]
    }

    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Search Console API error: ${response.status} - ${error}`)
    }

    const data: SearchAnalyticsResponse = await response.json()

    if (!data.rows || data.rows.length === 0) {
      return []
    }

    // Transform to our format
    return data.rows.map((row) => ({
      query: row.keys[0],
      page: row.keys[1] || filters.pageUrl || '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }))
  }

  /**
   * Get search data for a specific page
   */
  async getPageData(
    siteUrl: string,
    pageUrl: string,
    options: {
      dateRangeDays?: number
      rowLimit?: number
    } = {}
  ): Promise<SearchConsoleDataset> {
    const { dateRangeDays = 28, rowLimit = 1000 } = options

    // Calculate date range
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 3) // SC data has 3-day delay

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - dateRangeDays)

    const queries = await this.query({
      siteUrl,
      pageUrl,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      dimensions: ['query', 'page'],
      rowLimit,
    })

    // Calculate totals
    const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
    const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
    const avgPosition =
      queries.length > 0
        ? queries.reduce((sum, q) => sum + q.position * q.impressions, 0) / totalImpressions
        : 0

    return {
      siteUrl,
      pageUrl,
      queries,
      dateRange: {
        start: this.formatDate(startDate),
        end: this.formatDate(endDate),
      },
      totalClicks,
      totalImpressions,
      averagePosition: Math.round(avgPosition * 10) / 10,
      fetchedAt: new Date(),
    }
  }

  /**
   * List all sites the service account has access to
   */
  async listSites(): Promise<string[]> {
    const token = await this.getAccessToken()

    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list sites: ${error}`)
    }

    const data = await response.json()
    return (data.siteEntry || []).map((site: { siteUrl: string }) => site.siteUrl)
  }

  /**
   * Normalize site URL to Search Console format
   */
  private normalizeSiteUrl(url: string): string {
    // Search Console accepts URLs in format:
    // - https://example.com/ (URL prefix property)
    // - sc-domain:example.com (domain property)

    if (url.startsWith('sc-domain:')) {
      return url
    }

    // Ensure trailing slash for URL prefix properties
    if (!url.endsWith('/')) {
      return url + '/'
    }

    return url
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}

export { SearchConsoleClient as default }
