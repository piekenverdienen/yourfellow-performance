/**
 * Meta Graph API Client
 *
 * Wrapper for Meta (Facebook/Instagram) Marketing API.
 * Handles authentication, rate limiting, and error handling.
 *
 * API Version: v21.0 (current stable)
 * Docs: https://developers.facebook.com/docs/marketing-apis
 */

import type {
  MetaAdAccount,
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsightDaily,
  MetaEntityType,
} from '@/types/meta-ads'

// ============================================
// Constants
// ============================================

const META_API_VERSION = 'v21.0'
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

// Rate limit: 200 calls per hour per ad account (Marketing API)
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000 // Start with 1s, exponential backoff

// ============================================
// Types
// ============================================

interface MetaApiError {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

interface MetaApiResponse<T> {
  data?: T[]
  paging?: {
    cursors?: {
      before?: string
      after?: string
    }
    next?: string
    previous?: string
  }
  summary?: {
    total_count?: number
  }
}

interface MetaClientConfig {
  accessToken: string
  adAccountId?: string
}

// ============================================
// Meta API Client Class
// ============================================

export class MetaAdsClient {
  private accessToken: string
  private adAccountId?: string

  constructor(config: MetaClientConfig) {
    this.accessToken = config.accessToken
    this.adAccountId = config.adAccountId
  }

  // ============================================
  // Core HTTP Methods
  // ============================================

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    retryCount = 0
  ): Promise<T> {
    const url = new URL(`${META_API_BASE_URL}${endpoint}`)

    // Add access token and params
    url.searchParams.set('access_token', this.accessToken)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount)
          console.warn(`Meta API rate limited. Retrying in ${delay}ms...`)
          await this.sleep(delay)
          return this.request<T>(endpoint, params, retryCount + 1)
        }
        throw new Error('Meta API rate limit exceeded. Please try again later.')
      }

      const data = await response.json()

      // Check for API errors
      if (!response.ok || (data as MetaApiError).error) {
        const errorData = data as MetaApiError
        const errorMessage = errorData.error?.message || 'Unknown Meta API error'
        const errorCode = errorData.error?.code || response.status

        // Retry on transient errors
        if (retryCount < MAX_RETRIES && this.isRetryableError(errorCode)) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount)
          console.warn(`Meta API error (${errorCode}). Retrying in ${delay}ms...`)
          await this.sleep(delay)
          return this.request<T>(endpoint, params, retryCount + 1)
        }

        throw new Error(`Meta API Error [${errorCode}]: ${errorMessage}`)
      }

      return data as T
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Meta API')) {
        throw error
      }
      throw new Error(`Network error while calling Meta API: ${error}`)
    }
  }

  private isRetryableError(code: number): boolean {
    // Retry on rate limits and server errors
    return code === 429 || code === 1 || code === 2 || code >= 500
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ============================================
  // Ad Accounts
  // ============================================

  /**
   * Get ad accounts for the authenticated user or business
   */
  async getAdAccounts(businessId?: string): Promise<MetaAdAccount[]> {
    const endpoint = businessId
      ? `/${businessId}/owned_ad_accounts`
      : '/me/adaccounts'

    const fields = [
      'id',
      'account_id',
      'name',
      'currency',
      'timezone_name',
      'account_status',
      'amount_spent',
      'business{id,name}',
    ].join(',')

    const response = await this.request<MetaApiResponse<MetaAdAccount>>(
      endpoint,
      { fields, limit: 100 }
    )

    return response.data || []
  }

  /**
   * Get a specific ad account by ID
   */
  async getAdAccount(adAccountId: string): Promise<MetaAdAccount> {
    const fields = [
      'id',
      'account_id',
      'name',
      'currency',
      'timezone_name',
      'account_status',
      'amount_spent',
      'business{id,name}',
    ].join(',')

    return this.request<MetaAdAccount>(`/${adAccountId}`, { fields })
  }

  // ============================================
  // Campaigns
  // ============================================

  /**
   * Get all campaigns for an ad account
   */
  async getCampaigns(adAccountId?: string): Promise<MetaCampaign[]> {
    const accountId = adAccountId || this.adAccountId
    if (!accountId) throw new Error('Ad Account ID is required')

    const fields = [
      'id',
      'account_id',
      'name',
      'objective',
      'status',
      'effective_status',
      'daily_budget',
      'lifetime_budget',
      'created_time',
      'updated_time',
    ].join(',')

    const response = await this.request<MetaApiResponse<MetaCampaign>>(
      `/${accountId}/campaigns`,
      { fields, limit: 500 }
    )

    return response.data || []
  }

  // ============================================
  // Ad Sets
  // ============================================

  /**
   * Get all ad sets for an ad account
   */
  async getAdSets(adAccountId?: string): Promise<MetaAdSet[]> {
    const accountId = adAccountId || this.adAccountId
    if (!accountId) throw new Error('Ad Account ID is required')

    const fields = [
      'id',
      'account_id',
      'campaign_id',
      'name',
      'status',
      'effective_status',
      'daily_budget',
      'lifetime_budget',
      'targeting',
      'optimization_goal',
      'billing_event',
      'bid_amount',
      'created_time',
      'updated_time',
    ].join(',')

    const response = await this.request<MetaApiResponse<MetaAdSet>>(
      `/${accountId}/adsets`,
      { fields, limit: 500 }
    )

    return response.data || []
  }

  // ============================================
  // Ads
  // ============================================

  /**
   * Get all ads for an ad account
   */
  async getAds(adAccountId?: string): Promise<MetaAd[]> {
    const accountId = adAccountId || this.adAccountId
    if (!accountId) throw new Error('Ad Account ID is required')

    // Note: Keep fields minimal to avoid "too much data" error from Meta API
    // object_story_spec is too large - fetch separately if needed
    const fields = [
      'id',
      'account_id',
      'campaign_id',
      'adset_id',
      'name',
      'status',
      'effective_status',
      'creative{id,name,title,body,call_to_action_type,image_url,video_id,thumbnail_url}',
      'created_time',
      'updated_time',
    ].join(',')

    const response = await this.request<MetaApiResponse<MetaAd>>(
      `/${accountId}/ads`,
      { fields, limit: 500 }
    )

    return response.data || []
  }

  /**
   * Get ads with full creative details (slower, but gets image URLs)
   * Fetches in smaller batches to avoid API limits
   */
  async getAdsWithCreatives(adAccountId?: string): Promise<MetaAd[]> {
    const accountId = adAccountId || this.adAccountId
    if (!accountId) throw new Error('Ad Account ID is required')

    // First get basic ad info
    const basicFields = [
      'id',
      'name',
      'status',
      'effective_status',
      'creative{id}',
    ].join(',')

    const adsResponse = await this.request<MetaApiResponse<MetaAd>>(
      `/${accountId}/ads`,
      { fields: basicFields, limit: 500 }
    )

    const ads = adsResponse.data || []

    // Then fetch creative details for each ad (in parallel, max 10 at a time)
    const batchSize = 10
    for (let i = 0; i < ads.length; i += batchSize) {
      const batch = ads.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (ad) => {
          if (ad.creative?.id) {
            const details = await this.getCreativeDetails(ad.creative.id)
            if (details) {
              ad.creative = { ...ad.creative, ...details }
            }
          }
        })
      )
    }

    return ads
  }

  /**
   * Get creative details including image/video URLs
   * This fetches the actual creative assets which may not be in the ads endpoint
   */
  async getCreativeDetails(creativeId: string): Promise<MetaCreative | null> {
    try {
      const fields = [
        'id',
        'name',
        'title',
        'body',
        'call_to_action_type',
        'image_url',
        'thumbnail_url',
        'video_id',
        'object_story_spec',
        'asset_feed_spec',
        'effective_object_story_id',
      ].join(',')

      const response = await this.request<MetaCreative>(
        `/${creativeId}`,
        { fields }
      )

      return response
    } catch (error) {
      console.error(`Failed to fetch creative ${creativeId}:`, error)
      return null
    }
  }

  /**
   * Get ad previews (rendered ad images)
   * This is the most reliable way to get ad thumbnails
   */
  async getAdPreviews(adId: string, format: 'DESKTOP_FEED_STANDARD' | 'MOBILE_FEED_STANDARD' = 'MOBILE_FEED_STANDARD'): Promise<string | null> {
    try {
      const response = await this.request<{ data: Array<{ body: string }> }>(
        `/${adId}/previews`,
        { ad_format: format }
      )

      // The preview returns HTML, we'd need to extract the image
      // For now, return null - this is complex to parse
      return response.data?.[0]?.body || null
    } catch (error) {
      console.error(`Failed to fetch ad preview ${adId}:`, error)
      return null
    }
  }

  // ============================================
  // Insights (Performance Data)
  // ============================================

  /**
   * Get insights (performance metrics) for an entity
   *
   * @param entityId - Campaign, AdSet, or Ad ID (or Ad Account for account-level)
   * @param level - Breakdown level: account, campaign, adset, ad
   * @param dateStart - Start date (YYYY-MM-DD)
   * @param dateEnd - End date (YYYY-MM-DD)
   */
  async getInsights(
    entityId: string,
    level: MetaEntityType,
    dateStart: string,
    dateEnd: string
  ): Promise<MetaInsightRaw[]> {
    const fields = [
      // Identifiers
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      // Core metrics
      'impressions',
      'reach',
      'clicks',
      'spend',
      // Calculated metrics
      'ctr',
      'cpc',
      'cpm',
      'frequency',
      // Conversions (if available)
      'actions',
      'action_values',
      'conversions',
      'conversion_values',
      'cost_per_conversion',
      'purchase_roas',
      // Video metrics
      'video_p25_watched_actions',
      'video_p50_watched_actions',
      'video_p75_watched_actions',
      'video_p100_watched_actions',
    ].join(',')

    const params: Record<string, string | number | boolean> = {
      fields,
      level,
      time_range: JSON.stringify({
        since: dateStart,
        until: dateEnd,
      }),
      time_increment: 1, // Daily breakdown
      limit: 500,
    }

    const response = await this.request<MetaApiResponse<MetaInsightRaw>>(
      `/${entityId}/insights`,
      params
    )

    return response.data || []
  }

  /**
   * Get insights for the ad account with all entities
   */
  async getAccountInsights(
    adAccountId: string,
    dateStart: string,
    dateEnd: string,
    level: MetaEntityType = 'ad'
  ): Promise<MetaInsightRaw[]> {
    return this.getInsights(adAccountId, level, dateStart, dateEnd)
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; accountName?: string }> {
    try {
      if (this.adAccountId) {
        const account = await this.getAdAccount(this.adAccountId)
        return { success: true, accountName: account.name }
      } else {
        const accounts = await this.getAdAccounts()
        return {
          success: true,
          accountName: accounts.length > 0 ? `${accounts.length} accounts available` : 'No accounts found'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Format Ad Account ID (ensure act_ prefix)
   */
  static formatAdAccountId(id: string): string {
    if (id.startsWith('act_')) return id
    return `act_${id}`
  }
}

// ============================================
// Raw Insight Type (from API)
// ============================================

interface MetaInsightRaw {
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  impressions?: string
  reach?: string
  clicks?: string
  spend?: string
  ctr?: string
  cpc?: string
  cpm?: string
  frequency?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
  conversions?: { action_type: string; value: string }[]
  conversion_values?: { action_type: string; value: string }[]
  cost_per_conversion?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
  video_p25_watched_actions?: { action_type: string; value: string }[]
  video_p50_watched_actions?: { action_type: string; value: string }[]
  video_p75_watched_actions?: { action_type: string; value: string }[]
  video_p100_watched_actions?: { action_type: string; value: string }[]
  date_start?: string
  date_stop?: string
}

// ============================================
// Utility: Parse Raw Insights to Typed
// ============================================

export function parseMetaInsights(
  rawInsights: MetaInsightRaw[],
  clientId: string,
  adAccountId: string
): MetaInsightDaily[] {
  return rawInsights.map(raw => {
    // Determine entity type based on what IDs are present
    let entityType: MetaEntityType = 'account'
    let entityId = adAccountId
    let entityName = 'Account'

    if (raw.ad_id) {
      entityType = 'ad'
      entityId = raw.ad_id
      entityName = raw.ad_name || 'Unknown Ad'
    } else if (raw.adset_id) {
      entityType = 'adset'
      entityId = raw.adset_id
      entityName = raw.adset_name || 'Unknown AdSet'
    } else if (raw.campaign_id) {
      entityType = 'campaign'
      entityId = raw.campaign_id
      entityName = raw.campaign_name || 'Unknown Campaign'
    }

    // Parse conversions - ONLY count purchase events, not all conversion types
    // Priority order: omni_purchase > purchase > offsite_conversion.fb_pixel_purchase
    const purchaseActionTypes = [
      'omni_purchase',
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'onsite_conversion.purchase',
    ]

    // Find purchase actions in the actions array
    const purchaseActions = (raw.actions || []).filter(
      a => purchaseActionTypes.includes(a.action_type)
    )

    // Find purchase values in action_values array
    const purchaseValues = (raw.action_values || []).filter(
      a => purchaseActionTypes.includes(a.action_type)
    )

    // Also check the conversions array for purchase types (Meta sometimes puts them here)
    const purchaseConversions = (raw.conversions || []).filter(
      c => purchaseActionTypes.includes(c.action_type)
    )

    // Also check conversion_values for purchase types
    const purchaseConversionValues = (raw.conversion_values || []).filter(
      c => purchaseActionTypes.includes(c.action_type)
    )

    // Conversions: ONLY count purchases (no fallback to all conversions)
    // Check actions first, then conversions array
    let conversions = 0
    if (purchaseActions.length > 0) {
      conversions = purchaseActions.reduce((sum, c) => sum + parseFloat(c.value || '0'), 0)
    } else if (purchaseConversions.length > 0) {
      conversions = purchaseConversions.reduce((sum, c) => sum + parseFloat(c.value || '0'), 0)
    }

    // Conversion value: ONLY purchase values
    let conversionValue = 0
    if (purchaseValues.length > 0) {
      conversionValue = purchaseValues.reduce((sum, c) => sum + parseFloat(c.value || '0'), 0)
    } else if (purchaseConversionValues.length > 0) {
      conversionValue = purchaseConversionValues.reduce((sum, c) => sum + parseFloat(c.value || '0'), 0)
    }

    // Cost per conversion - only for purchase types
    const purchaseCostPer = (raw.cost_per_conversion || []).filter(
      c => purchaseActionTypes.includes(c.action_type)
    )
    const costPerConversion = purchaseCostPer.length > 0
      ? purchaseCostPer.reduce((sum, c) => sum + parseFloat(c.value || '0'), 0) / purchaseCostPer.length
      : 0

    // ROAS: prefer purchase_roas from Meta, fallback to calculated
    const purchaseRoas = (raw.purchase_roas || []).find(
      r => r.action_type === 'omni_purchase' || r.action_type === 'purchase'
    )
    const roasFromMeta = purchaseRoas ? parseFloat(purchaseRoas.value || '0') : null

    // Parse video metrics
    const videoP25 = (raw.video_p25_watched_actions || []).reduce(
      (sum, v) => sum + parseInt(v.value || '0'),
      0
    )
    const videoP50 = (raw.video_p50_watched_actions || []).reduce(
      (sum, v) => sum + parseInt(v.value || '0'),
      0
    )
    const videoP75 = (raw.video_p75_watched_actions || []).reduce(
      (sum, v) => sum + parseInt(v.value || '0'),
      0
    )
    const videoP100 = (raw.video_p100_watched_actions || []).reduce(
      (sum, v) => sum + parseInt(v.value || '0'),
      0
    )

    const spend = parseFloat(raw.spend || '0')

    return {
      client_id: clientId,
      ad_account_id: adAccountId,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      campaign_id: raw.campaign_id,
      campaign_name: raw.campaign_name,
      adset_id: raw.adset_id,
      adset_name: raw.adset_name,
      date: raw.date_start || new Date().toISOString().split('T')[0],

      // Core metrics
      impressions: parseInt(raw.impressions || '0'),
      reach: parseInt(raw.reach || '0'),
      clicks: parseInt(raw.clicks || '0'),
      spend,

      // Calculated metrics
      ctr: parseFloat(raw.ctr || '0'),
      cpc: parseFloat(raw.cpc || '0'),
      cpm: parseFloat(raw.cpm || '0'),
      frequency: parseFloat(raw.frequency || '0'),

      // Conversions
      conversions,
      conversion_value: conversionValue,
      cost_per_conversion: costPerConversion,
      roas: roasFromMeta !== null ? roasFromMeta : (spend > 0 ? conversionValue / spend : 0),

      // Video
      video_views: videoP25, // P25 = started watching
      video_p25_watched: videoP25,
      video_p50_watched: videoP50,
      video_p75_watched: videoP75,
      video_p100_watched: videoP100,
    }
  })
}

// ============================================
// Factory Function
// ============================================

export function createMetaClient(accessToken: string, adAccountId?: string): MetaAdsClient {
  return new MetaAdsClient({
    accessToken,
    adAccountId: adAccountId ? MetaAdsClient.formatAdAccountId(adAccountId) : undefined,
  })
}
