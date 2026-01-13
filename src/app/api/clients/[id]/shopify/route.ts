/**
 * Shopify Data API
 *
 * GET: Fetch Shopify metrics for Control Room dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ShopifySettings, ShopifyTopProduct } from '@/types'

interface ShopifyDataPoint {
  date: string
  revenue: number
  orders: number
  aov: number
  newCustomers: number
}

interface ShopifySummary {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  revenueChange: number
  ordersChange: number
  aovChange: number
  topProducts: ShopifyTopProduct[]
  period: {
    start: string
    end: string
  }
}

interface ShopifyOrderRow {
  date: string
  total_revenue: number | null
  total_orders: number | null
  average_order_value: number | null
  total_customers: number | null
  new_customers: number | null
  returning_customers: number | null
  top_products: ShopifyTopProduct[] | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }

    // Fetch client - RLS will handle access control
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, settings')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Client niet gevonden of geen toegang' }, { status: 404 })
      }
      console.error('Error fetching client:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if Shopify is configured
    const shopifySettings = client.settings?.shopify as ShopifySettings | undefined
    if (!shopifySettings?.storeId || !shopifySettings?.enabled) {
      return NextResponse.json({
        enabled: false,
        message: 'Shopify niet geconfigureerd voor deze client'
      })
    }

    // Calculate date range (last 14 days)
    const endDate = getYesterdayDate()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 13) // 14 days total

    // Previous period for comparison
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)
    const previousStartDate = new Date(previousEndDate)
    previousStartDate.setDate(previousStartDate.getDate() - 13)

    // Fetch current period data
    const { data: currentData, error: dataError } = await supabase
      .from('shopify_orders_daily')
      .select('*')
      .eq('client_id', id)
      .gte('date', formatDate(startDate))
      .lte('date', formatDate(endDate))
      .order('date', { ascending: true })

    if (dataError) {
      console.error('Error fetching Shopify data:', dataError)
      return NextResponse.json({ error: dataError.message }, { status: 500 })
    }

    // Check if we have any data
    if (!currentData || currentData.length === 0) {
      return NextResponse.json({
        enabled: true,
        storeId: shopifySettings.storeId,
        data: [],
        summary: null,
        message: 'Geen Shopify data beschikbaar voor deze periode'
      })
    }

    // Convert to data points
    const dataPoints: ShopifyDataPoint[] = (currentData as ShopifyOrderRow[]).map((row) => ({
      date: row.date,
      revenue: row.total_revenue || 0,
      orders: row.total_orders || 0,
      aov: row.average_order_value || 0,
      newCustomers: row.new_customers || 0,
    }))

    // Fetch previous period for comparison
    const { data: previousData } = await supabase
      .from('shopify_orders_daily')
      .select('total_revenue, total_orders, average_order_value')
      .eq('client_id', id)
      .gte('date', formatDate(previousStartDate))
      .lte('date', formatDate(previousEndDate))

    // Calculate totals for current period
    const currentTotals = (currentData as ShopifyOrderRow[]).reduce(
      (acc, row) => ({
        revenue: acc.revenue + (row.total_revenue || 0),
        orders: acc.orders + (row.total_orders || 0),
        customers: acc.customers + (row.total_customers || 0),
        newCustomers: acc.newCustomers + (row.new_customers || 0),
        returningCustomers: acc.returningCustomers + (row.returning_customers || 0),
      }),
      { revenue: 0, orders: 0, customers: 0, newCustomers: 0, returningCustomers: 0 }
    )

    // Calculate totals for previous period
    const previousTotals = ((previousData || []) as Array<{ total_revenue: number | null; total_orders: number | null }>).reduce(
      (acc, row) => ({
        revenue: acc.revenue + (row.total_revenue || 0),
        orders: acc.orders + (row.total_orders || 0),
      }),
      { revenue: 0, orders: 0 }
    )

    // Calculate AOV
    const currentAOV = currentTotals.orders > 0 ? currentTotals.revenue / currentTotals.orders : 0
    const previousAOV = previousTotals.orders > 0 ? previousTotals.revenue / previousTotals.orders : 0

    // Calculate percentage changes
    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100 * 10) / 10
    }

    // Aggregate top products across all days
    const productMap = new Map<string, { quantity: number; revenue: number }>()
    for (const row of (currentData as ShopifyOrderRow[])) {
      const products = row.top_products || []
      for (const product of products) {
        const existing = productMap.get(product.title) || { quantity: 0, revenue: 0 }
        existing.quantity += product.quantity
        existing.revenue += product.revenue
        productMap.set(product.title, existing)
      }
    }

    const topProducts: ShopifyTopProduct[] = Array.from(productMap.entries())
      .map(([title, stats]) => ({ title, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const summary: ShopifySummary = {
      totalRevenue: Math.round(currentTotals.revenue * 100) / 100,
      totalOrders: currentTotals.orders,
      avgOrderValue: Math.round(currentAOV * 100) / 100,
      totalCustomers: currentTotals.customers,
      newCustomers: currentTotals.newCustomers,
      returningCustomers: currentTotals.returningCustomers,
      revenueChange: calcChange(currentTotals.revenue, previousTotals.revenue),
      ordersChange: calcChange(currentTotals.orders, previousTotals.orders),
      aovChange: calcChange(currentAOV, previousAOV),
      topProducts,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
    }

    return NextResponse.json({
      enabled: true,
      storeId: shopifySettings.storeId,
      currency: shopifySettings.currency || 'EUR',
      data: dataPoints,
      summary,
    })
  } catch (error) {
    console.error('Shopify data fetch error:', error)
    return NextResponse.json({
      error: 'Fout bij ophalen van Shopify data',
      details: error instanceof Error ? error.message : 'Onbekende fout',
    }, { status: 500 })
  }
}

function getYesterdayDate(): Date {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  now.setHours(0, 0, 0, 0)
  return now
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
