/**
 * Shopify Sync Service
 *
 * Syncs order data from Shopify Admin API to Supabase.
 * Designed for daily/scheduled sync operations.
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { ShopifySettings, ShopifyOrdersDaily, ShopifyTopProduct } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types
// ============================================

export interface ShopifySyncRequest {
  clientId: string
  storeId?: string
  dateStart?: string
  dateEnd?: string
}

export interface ShopifySyncResponse {
  success: boolean
  synced: {
    days: number
    orders: number
  }
  errors?: string[]
}

interface ShopifyOrder {
  id: number
  created_at: string
  total_price: string
  currency: string
  financial_status: string
  customer?: {
    id: number
    orders_count: number
  }
  line_items: Array<{
    title: string
    quantity: number
    price: string
  }>
  refunds?: Array<{
    id: number
    created_at: string
    transactions: Array<{
      amount: string
    }>
  }>
}

interface ShopifySyncServiceOptions {
  useServiceRole?: boolean
}

// ============================================
// Shopify API Client
// ============================================

class ShopifyClient {
  private storeId: string
  private accessToken: string
  private apiVersion = '2024-01'

  constructor(storeId: string, accessToken: string) {
    this.storeId = storeId
    this.accessToken = accessToken
  }

  private get baseUrl(): string {
    return `https://${this.storeId}.myshopify.com/admin/api/${this.apiVersion}`
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Fetch orders for a specific date range
   */
  async getOrders(dateStart: string, dateEnd: string): Promise<ShopifyOrder[]> {
    const allOrders: ShopifyOrder[] = []
    let hasMore = true
    let pageInfo: string | undefined

    // Shopify uses cursor-based pagination
    while (hasMore) {
      const params: Record<string, string> = {
        status: 'any',
        created_at_min: `${dateStart}T00:00:00Z`,
        created_at_max: `${dateEnd}T23:59:59Z`,
        limit: '250',
      }

      if (pageInfo) {
        params.page_info = pageInfo
      }

      const response = await this.request<{ orders: ShopifyOrder[] }>('/orders.json', params)
      allOrders.push(...response.orders)

      // Check for more pages (simplified - in production, parse Link header)
      hasMore = response.orders.length === 250
      if (hasMore && response.orders.length > 0) {
        // This is a simplified version - real implementation should use cursor pagination
        // For now, we'll just get the first page
        hasMore = false
      }
    }

    return allOrders
  }

  /**
   * Test the connection to Shopify
   */
  async testConnection(): Promise<{ success: boolean; storeName?: string; error?: string }> {
    try {
      const response = await this.request<{ shop: { name: string; domain: string } }>('/shop.json')
      return {
        success: true,
        storeName: response.shop.name,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// ============================================
// Shopify Sync Service
// ============================================

export class ShopifySyncService {
  private supabase: SupabaseClient | null = null
  private useServiceRole: boolean

  constructor(options: ShopifySyncServiceOptions = {}) {
    this.useServiceRole = options.useServiceRole ?? false
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (!this.supabase) {
      if (this.useServiceRole) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceKey) {
          throw new Error('Missing Supabase service credentials for cron sync')
        }

        this.supabase = createServiceClient(supabaseUrl, serviceKey)
      } else {
        this.supabase = await createClient()
      }
    }
    return this.supabase
  }

  /**
   * Sync Shopify data for a specific client
   */
  async syncClient(request: ShopifySyncRequest): Promise<ShopifySyncResponse> {
    const { clientId, dateStart, dateEnd } = request

    const stats = {
      days: 0,
      orders: 0,
    }
    const errors: string[] = []

    try {
      const supabase = await this.getSupabase()
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', clientId)
        .single()

      if (clientError || !client) {
        return {
          success: false,
          synced: stats,
          errors: ['Client not found'],
        }
      }

      const shopifySettings = client.settings?.shopify as ShopifySettings | undefined
      if (!shopifySettings?.enabled || !shopifySettings.accessToken || !shopifySettings.storeId) {
        return {
          success: false,
          synced: stats,
          errors: ['Shopify not configured for this client'],
        }
      }

      // Initialize Shopify client
      const shopifyClient = new ShopifyClient(
        shopifySettings.storeId,
        shopifySettings.accessToken
      )

      // Calculate date range (default: last 14 days)
      const end = dateEnd || new Date().toISOString().split('T')[0]
      const start = dateStart || this.getDateDaysAgo(14)

      // Fetch orders
      const orders = await shopifyClient.getOrders(start, end)
      stats.orders = orders.length

      // Aggregate by day
      const dailyData = this.aggregateOrdersByDay(
        orders,
        clientId,
        shopifySettings.storeId,
        shopifySettings.currency || 'EUR'
      )

      // Upsert to database
      await this.upsertDailyData(dailyData)
      stats.days = dailyData.length

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(clientId)

      return {
        success: true,
        synced: stats,
      }
    } catch (error) {
      console.error('Shopify sync error:', error)
      return {
        success: false,
        synced: stats,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Aggregate orders by day
   */
  private aggregateOrdersByDay(
    orders: ShopifyOrder[],
    clientId: string,
    storeId: string,
    currency: string
  ): Omit<ShopifyOrdersDaily, 'id' | 'created_at' | 'updated_at'>[] {
    const dailyMap = new Map<string, {
      orders: number
      revenue: number
      customers: Set<number>
      newCustomers: number
      returningCustomers: number
      refundCount: number
      refundAmount: number
      products: Map<string, { quantity: number; revenue: number }>
    }>()

    for (const order of orders) {
      // Skip cancelled/voided orders
      if (order.financial_status === 'voided') continue

      const date = order.created_at.split('T')[0]
      const revenue = parseFloat(order.total_price) || 0

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          orders: 0,
          revenue: 0,
          customers: new Set(),
          newCustomers: 0,
          returningCustomers: 0,
          refundCount: 0,
          refundAmount: 0,
          products: new Map(),
        })
      }

      const day = dailyMap.get(date)!

      // Count orders and revenue (only for paid/pending orders)
      if (order.financial_status !== 'refunded') {
        day.orders++
        day.revenue += revenue
      }

      // Track customers
      if (order.customer) {
        day.customers.add(order.customer.id)
        if (order.customer.orders_count === 1) {
          day.newCustomers++
        } else {
          day.returningCustomers++
        }
      }

      // Track refunds
      if (order.refunds && order.refunds.length > 0) {
        day.refundCount += order.refunds.length
        for (const refund of order.refunds) {
          for (const transaction of refund.transactions) {
            day.refundAmount += parseFloat(transaction.amount) || 0
          }
        }
      }

      // Track products
      for (const item of order.line_items) {
        const existing = day.products.get(item.title) || { quantity: 0, revenue: 0 }
        existing.quantity += item.quantity
        existing.revenue += parseFloat(item.price) * item.quantity
        day.products.set(item.title, existing)
      }
    }

    // Convert to array
    return Array.from(dailyMap.entries()).map(([date, data]) => {
      // Get top 5 products
      const topProducts: ShopifyTopProduct[] = Array.from(data.products.entries())
        .map(([title, stats]) => ({ title, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      return {
        client_id: clientId,
        store_id: storeId,
        date,
        total_orders: data.orders,
        total_revenue: Math.round(data.revenue * 100) / 100,
        average_order_value: data.orders > 0
          ? Math.round((data.revenue / data.orders) * 100) / 100
          : 0,
        total_customers: data.customers.size,
        new_customers: data.newCustomers,
        returning_customers: data.returningCustomers,
        refund_count: data.refundCount,
        refund_amount: Math.round(data.refundAmount * 100) / 100,
        top_products: topProducts,
        currency,
      }
    })
  }

  /**
   * Upsert daily data to database
   */
  private async upsertDailyData(
    data: Omit<ShopifyOrdersDaily, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<void> {
    if (data.length === 0) return

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('shopify_orders_daily')
      .upsert(data, {
        onConflict: 'client_id,store_id,date',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error('Upsert error:', error)
      throw new Error(`Failed to upsert Shopify data: ${error.message}`)
    }
  }

  /**
   * Update the last sync timestamp for a client
   */
  private async updateLastSyncTimestamp(clientId: string): Promise<void> {
    const supabase = await this.getSupabase()

    const { data: client } = await supabase
      .from('clients')
      .select('settings')
      .eq('id', clientId)
      .single()

    if (!client) return

    const settings = client.settings || {}
    const shopifySettings = (settings.shopify || {}) as ShopifySettings

    shopifySettings.lastSyncAt = new Date().toISOString()

    await supabase
      .from('clients')
      .update({
        settings: {
          ...settings,
          shopify: shopifySettings,
        },
      })
      .eq('id', clientId)
  }

  /**
   * Sync all enabled clients
   */
  async syncAllClients(): Promise<{
    total: number
    success: number
    failed: number
    results: { clientId: string; clientName: string; result: ShopifySyncResponse }[]
  }> {
    const supabase = await this.getSupabase()

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('is_active', true)

    if (error || !clients) {
      return { total: 0, success: 0, failed: 0, results: [] }
    }

    interface ClientRow {
      id: string
      name: string
      settings: Record<string, unknown> | null
    }

    const enabledClients = (clients as ClientRow[]).filter((c) => {
      const shopify = c.settings?.shopify as ShopifySettings | undefined
      return shopify?.enabled && shopify?.syncEnabled && shopify?.accessToken && shopify?.storeId
    })

    const results: { clientId: string; clientName: string; result: ShopifySyncResponse }[] = []
    let success = 0
    let failed = 0

    for (const client of enabledClients) {
      const result = await this.syncClient({
        clientId: client.id,
      })

      results.push({
        clientId: client.id,
        clientName: client.name,
        result,
      })

      if (result.success) {
        success++
      } else {
        failed++
      }
    }

    return {
      total: enabledClients.length,
      success,
      failed,
      results,
    }
  }

  /**
   * Get performance data for dashboard
   */
  async getPerformanceData(
    clientId: string,
    days: number = 14
  ): Promise<{
    data: ShopifyOrdersDaily[]
    summary: {
      totalRevenue: number
      totalOrders: number
      avgOrderValue: number
      totalCustomers: number
      newCustomers: number
      returningCustomers: number
      revenueChange: number
      ordersChange: number
    } | null
  }> {
    const supabase = await this.getSupabase()

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get current period data
    const { data, error } = await supabase
      .from('shopify_orders_daily')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error || !data || data.length === 0) {
      return { data: [], summary: null }
    }

    // Calculate current period totals
    const currentTotals = (data as ShopifyOrdersDaily[]).reduce(
      (acc, row) => ({
        revenue: acc.revenue + (row.total_revenue || 0),
        orders: acc.orders + (row.total_orders || 0),
        customers: acc.customers + (row.total_customers || 0),
        newCustomers: acc.newCustomers + (row.new_customers || 0),
        returningCustomers: acc.returningCustomers + (row.returning_customers || 0),
      }),
      { revenue: 0, orders: 0, customers: 0, newCustomers: 0, returningCustomers: 0 }
    )

    // Get previous period data for comparison
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDate = new Date(prevEndDate)
    prevStartDate.setDate(prevStartDate.getDate() - days)

    const { data: prevData } = await supabase
      .from('shopify_orders_daily')
      .select('total_revenue, total_orders')
      .eq('client_id', clientId)
      .gte('date', prevStartDate.toISOString().split('T')[0])
      .lte('date', prevEndDate.toISOString().split('T')[0])

    // Calculate previous period totals
    const prevTotals = (prevData || []).reduce(
      (acc, row: { total_revenue: number; total_orders: number }) => ({
        revenue: acc.revenue + (row.total_revenue || 0),
        orders: acc.orders + (row.total_orders || 0),
      }),
      { revenue: 0, orders: 0 }
    )

    // Calculate changes
    const revenueChange = prevTotals.revenue > 0
      ? Math.round(((currentTotals.revenue - prevTotals.revenue) / prevTotals.revenue) * 100)
      : 0

    const ordersChange = prevTotals.orders > 0
      ? Math.round(((currentTotals.orders - prevTotals.orders) / prevTotals.orders) * 100)
      : 0

    return {
      data: data as ShopifyOrdersDaily[],
      summary: {
        totalRevenue: Math.round(currentTotals.revenue * 100) / 100,
        totalOrders: currentTotals.orders,
        avgOrderValue: currentTotals.orders > 0
          ? Math.round((currentTotals.revenue / currentTotals.orders) * 100) / 100
          : 0,
        totalCustomers: currentTotals.customers,
        newCustomers: currentTotals.newCustomers,
        returningCustomers: currentTotals.returningCustomers,
        revenueChange,
        ordersChange,
      },
    }
  }

  /**
   * Test Shopify connection
   */
  async testConnection(storeId: string, accessToken: string): Promise<{
    success: boolean
    storeName?: string
    error?: string
  }> {
    const client = new ShopifyClient(storeId, accessToken)
    return client.testConnection()
  }

  // ============================================
  // Helpers
  // ============================================

  private getDateDaysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
  }
}

// ============================================
// Singleton Export
// ============================================

let syncServiceInstance: ShopifySyncService | null = null
let cronSyncServiceInstance: ShopifySyncService | null = null

/**
 * Get sync service for user-authenticated API routes
 */
export function getShopifySyncService(): ShopifySyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ShopifySyncService({ useServiceRole: false })
  }
  return syncServiceInstance
}

/**
 * Get sync service for cron jobs (uses service role key, bypasses RLS)
 */
export function getShopifyCronSyncService(): ShopifySyncService {
  if (!cronSyncServiceInstance) {
    cronSyncServiceInstance = new ShopifySyncService({ useServiceRole: true })
  }
  return cronSyncServiceInstance
}
