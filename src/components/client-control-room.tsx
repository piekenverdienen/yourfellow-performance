'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  MousePointerClick,
  Loader2,
  AlertCircle,
  BarChart3,
  Megaphone,
  Share2,
  Euro,
  Target,
  ShoppingCart,
  Calculator,
  ShoppingBag,
  UserPlus
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GA4DataPoint {
  date: string
  sessions: number
  totalUsers: number
  engagementRate: number
}

interface GA4Summary {
  totalSessions: number
  totalUsers: number
  avgEngagementRate: number
  sessionsChange: number
  period: {
    start: string
    end: string
  }
}

interface GA4Response {
  enabled: boolean
  propertyId?: string
  data?: GA4DataPoint[]
  summary?: GA4Summary
  message?: string
  error?: string
}

interface MetaDataPoint {
  date: string
  spend: number
  roas: number
  conversions: number
  cpa: number
}

interface MetaSummary {
  totalSpend: number
  avgROAS: number
  totalConversions: number
  avgCPA: number
  spendChange: number
  roasChange: number
  conversionsChange: number
  cpaChange: number
  period: {
    start: string
    end: string
  }
}

interface MetaResponse {
  enabled: boolean
  adAccountId?: string
  data?: MetaDataPoint[]
  summary?: MetaSummary | null
  message?: string
  error?: string
}

interface ShopifyDataPoint {
  date: string
  revenue: number
  orders: number
  aov: number
  newCustomers: number
}

interface ShopifyTopProduct {
  title: string
  quantity: number
  revenue: number
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

interface ShopifyResponse {
  enabled: boolean
  storeId?: string
  currency?: string
  data?: ShopifyDataPoint[]
  summary?: ShopifySummary | null
  message?: string
  error?: string
}

interface ClientControlRoomProps {
  clientId: string
  clientName: string
}

type ControlRoomTab = 'ga4' | 'meta' | 'shopify' | 'google-ads'

export function ClientControlRoom({ clientId, clientName }: ClientControlRoomProps) {
  const [activeTab, setActiveTab] = useState<ControlRoomTab>('ga4')
  const [ga4Data, setGa4Data] = useState<GA4Response | null>(null)
  const [metaData, setMetaData] = useState<MetaResponse | null>(null)
  const [shopifyData, setShopifyData] = useState<ShopifyResponse | null>(null)
  const [ga4Loading, setGa4Loading] = useState(true)
  const [metaLoading, setMetaLoading] = useState(true)
  const [shopifyLoading, setShopifyLoading] = useState(true)
  const [ga4Error, setGa4Error] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [shopifyError, setShopifyError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGA4Data() {
      try {
        setGa4Loading(true)
        setGa4Error(null)
        const response = await fetch(`/api/clients/${clientId}/ga4`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Fout bij ophalen van data')
        }

        setGa4Data(data)
      } catch (err) {
        setGa4Error(err instanceof Error ? err.message : 'Onbekende fout')
      } finally {
        setGa4Loading(false)
      }
    }

    async function fetchMetaData() {
      try {
        setMetaLoading(true)
        setMetaError(null)
        const response = await fetch(`/api/clients/${clientId}/meta-ads`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Fout bij ophalen van data')
        }

        setMetaData(data)
      } catch (err) {
        setMetaError(err instanceof Error ? err.message : 'Onbekende fout')
      } finally {
        setMetaLoading(false)
      }
    }

    async function fetchShopifyData() {
      try {
        setShopifyLoading(true)
        setShopifyError(null)
        const response = await fetch(`/api/clients/${clientId}/shopify`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Fout bij ophalen van data')
        }

        setShopifyData(data)
      } catch (err) {
        setShopifyError(err instanceof Error ? err.message : 'Onbekende fout')
      } finally {
        setShopifyLoading(false)
      }
    }

    fetchGA4Data()
    fetchMetaData()
    fetchShopifyData()
  }, [clientId])

  // Format date for display
  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length && label) {
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900 mb-2">
            {new Date(label).toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'long'
            })}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-surface-600">
              {entry.dataKey === 'sessions' && 'Sessies: '}
              {entry.dataKey === 'totalUsers' && 'Gebruikers: '}
              {entry.dataKey === 'engagementRate' && 'Engagement: '}
              <span className="font-medium text-surface-900">
                {entry.dataKey === 'engagementRate'
                  ? `${entry.value.toFixed(1)}%`
                  : entry.value.toLocaleString('nl-NL')}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Render GA4 section
  const renderGA4Section = () => {
    if (ga4Loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )
    }

    if (ga4Error) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{ga4Error}</p>
        </div>
      )
    }

    if (!ga4Data?.enabled) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <BarChart3 className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-surface-600">GA4 monitoring niet ingeschakeld</p>
            <p className="text-xs text-surface-500 mt-1">
              Configureer GA4 in de klantinstellingen om data te zien.
            </p>
          </div>
        </div>
      )
    }

    if (!ga4Data.data || ga4Data.data.length === 0) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <BarChart3 className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <p className="text-sm text-surface-600">Geen GA4 data beschikbaar</p>
        </div>
      )
    }

    const summary = ga4Data.summary!
    const isPositiveChange = summary.sessionsChange >= 0

    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Sessies</span>
            </div>
            <p className="text-xl font-bold text-surface-900">
              {summary.totalSessions.toLocaleString('nl-NL')}
            </p>
            <div className={cn(
              "flex items-center justify-center gap-1 text-xs mt-1",
              isPositiveChange ? "text-green-600" : "text-red-600"
            )}>
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{isPositiveChange ? '+' : ''}{summary.sessionsChange}%</span>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Gebruikers</span>
            </div>
            <p className="text-xl font-bold text-surface-900">
              {summary.totalUsers.toLocaleString('nl-NL')}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs">Engagement</span>
            </div>
            <p className="text-xl font-bold text-surface-900">
              {summary.avgEngagementRate}%
            </p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={ga4Data.data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#00FFCC"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#00FFCC' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Period indicator */}
        <p className="text-xs text-surface-500 text-center">
          Periode: {new Date(summary.period.start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {new Date(summary.period.end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    )
  }

  // Custom tooltip for Meta chart
  const MetaCustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length && label) {
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900 mb-2">
            {new Date(label).toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'long'
            })}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-surface-600">
              {entry.dataKey === 'spend' && 'Spend: '}
              {entry.dataKey === 'roas' && 'ROAS: '}
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.dataKey === 'spend'
                  ? `€${entry.value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : entry.value.toFixed(2)}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Render Meta Ads section
  const renderMetaSection = () => {
    if (metaLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )
    }

    if (metaError) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{metaError}</p>
        </div>
      )
    }

    if (!metaData?.enabled) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <Share2 className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-surface-600">Meta Ads niet ingeschakeld</p>
            <p className="text-xs text-surface-500 mt-1">
              Configureer Meta Ads in de klantinstellingen om data te zien.
            </p>
          </div>
        </div>
      )
    }

    if (!metaData.data || metaData.data.length === 0 || !metaData.summary) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <Share2 className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <p className="text-sm text-surface-600">Geen Meta Ads data beschikbaar</p>
        </div>
      )
    }

    const summary = metaData.summary

    // Helper to render trend indicator
    const renderTrend = (change: number, invertColors = false) => {
      const isPositive = invertColors ? change <= 0 : change >= 0
      return (
        <div className={cn(
          "flex items-center justify-center gap-1 text-xs mt-1",
          isPositive ? "text-green-600" : "text-red-600"
        )}>
          {change >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{change >= 0 ? '+' : ''}{change}%</span>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Summary Stats - 4 KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Euro className="h-4 w-4" />
              <span className="text-xs">Spend</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              €{summary.totalSpend.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {renderTrend(summary.spendChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs">ROAS</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {summary.avgROAS.toFixed(2)}
            </p>
            {renderTrend(summary.roasChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Conversies</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {summary.totalConversions.toLocaleString('nl-NL')}
            </p>
            {renderTrend(summary.conversionsChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Calculator className="h-4 w-4" />
              <span className="text-xs">CPA</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              €{summary.avgCPA.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {renderTrend(summary.cpaChange, true)} {/* Invert: lower CPA is better */}
          </div>
        </div>

        {/* Dual Axis Chart: Spend + ROAS */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={metaData.data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `€${value}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
              />
              <Tooltip content={<MetaCustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={24}
                formatter={(value) => <span className="text-xs text-surface-600">{value === 'spend' ? 'Spend' : 'ROAS'}</span>}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="spend"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3B82F6' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="roas"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#10B981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Period indicator */}
        <p className="text-xs text-surface-500 text-center">
          Periode: {new Date(summary.period.start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {new Date(summary.period.end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    )
  }

  // Custom tooltip for Shopify chart
  const ShopifyCustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length && label) {
      const currency = shopifyData?.currency || 'EUR'
      return (
        <div className="bg-white border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-surface-900 mb-2">
            {new Date(label).toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'long'
            })}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-surface-600">
              {entry.dataKey === 'revenue' && 'Omzet: '}
              {entry.dataKey === 'orders' && 'Orders: '}
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.dataKey === 'revenue'
                  ? `${currency === 'EUR' ? '€' : currency}${entry.value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : entry.value.toLocaleString('nl-NL')}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Render Shopify section
  const renderShopifySection = () => {
    if (shopifyLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )
    }

    if (shopifyError) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{shopifyError}</p>
        </div>
      )
    }

    if (!shopifyData?.enabled) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <ShoppingBag className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-surface-600">Shopify niet ingeschakeld</p>
            <p className="text-xs text-surface-500 mt-1">
              Configureer Shopify in de klantinstellingen om data te zien.
            </p>
          </div>
        </div>
      )
    }

    if (!shopifyData.data || shopifyData.data.length === 0 || !shopifyData.summary) {
      return (
        <div className="flex items-center gap-3 py-8 px-4 bg-surface-50 rounded-lg">
          <ShoppingBag className="h-5 w-5 text-surface-400 flex-shrink-0" />
          <p className="text-sm text-surface-600">Geen Shopify data beschikbaar</p>
        </div>
      )
    }

    const summary = shopifyData.summary
    const currency = shopifyData.currency || 'EUR'
    const currencySymbol = currency === 'EUR' ? '€' : currency

    // Helper to render trend indicator
    const renderTrend = (change: number, invertColors = false) => {
      const isPositive = invertColors ? change <= 0 : change >= 0
      return (
        <div className={cn(
          "flex items-center justify-center gap-1 text-xs mt-1",
          isPositive ? "text-green-600" : "text-red-600"
        )}>
          {change >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{change >= 0 ? '+' : ''}{change}%</span>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Summary Stats - 4 KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Euro className="h-4 w-4" />
              <span className="text-xs">Omzet</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {currencySymbol}{summary.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {renderTrend(summary.revenueChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs">Orders</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {summary.totalOrders.toLocaleString('nl-NL')}
            </p>
            {renderTrend(summary.ordersChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <Calculator className="h-4 w-4" />
              <span className="text-xs">AOV</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {currencySymbol}{summary.avgOrderValue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {renderTrend(summary.aovChange)}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs">Nieuwe klanten</span>
            </div>
            <p className="text-lg font-bold text-surface-900">
              {summary.newCustomers.toLocaleString('nl-NL')}
            </p>
          </div>
        </div>

        {/* Dual Axis Chart: Revenue + Orders */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={shopifyData.data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${currencySymbol}${value}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
              />
              <Tooltip content={<ShopifyCustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={24}
                formatter={(value) => <span className="text-xs text-surface-600">{value === 'revenue' ? 'Omzet' : 'Orders'}</span>}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#95BF47"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#95BF47' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                stroke="#5C6AC4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#5C6AC4' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        {summary.topProducts && summary.topProducts.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-surface-600 mb-2">Top producten</p>
            <div className="space-y-1.5">
              {summary.topProducts.slice(0, 3).map((product, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-surface-700 truncate max-w-[180px]">{product.title}</span>
                  <span className="text-surface-500">
                    {product.quantity}x · {currencySymbol}{product.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Period indicator */}
        <p className="text-xs text-surface-500 text-center">
          Periode: {new Date(summary.period.start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {new Date(summary.period.end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    )
  }

  // Tab configuration
  const tabs = [
    {
      id: 'ga4' as const,
      label: 'Google Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      iconBg: 'bg-[#F9AB00]',
      enabled: ga4Data?.enabled,
    },
    {
      id: 'meta' as const,
      label: 'Meta Ads',
      icon: <Share2 className="h-4 w-4" />,
      iconBg: 'bg-gradient-to-tr from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]',
      enabled: metaData?.enabled,
    },
    {
      id: 'shopify' as const,
      label: 'Shopify',
      icon: <ShoppingBag className="h-4 w-4" />,
      iconBg: 'bg-[#95BF47]',
      enabled: shopifyData?.enabled,
    },
    {
      id: 'google-ads' as const,
      label: 'Google Ads',
      icon: <Megaphone className="h-4 w-4" />,
      iconBg: 'bg-[#4285F4]',
      enabled: false,
      comingSoon: true,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Control Room</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {clientName}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200 -mx-6 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
              disabled={tab.comingSoon}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-primary text-surface-900"
                  : tab.comingSoon
                  ? "border-transparent text-surface-400 cursor-not-allowed"
                  : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded flex items-center justify-center text-white",
                tab.iconBg,
                tab.comingSoon && "opacity-50"
              )}>
                {tab.icon}
              </div>
              <span>{tab.label}</span>
              {tab.enabled && (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              )}
              {tab.comingSoon && (
                <span className="text-xs text-surface-400 ml-1">soon</span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* GA4 Content */}
        {activeTab === 'ga4' && renderGA4Section()}

        {/* Meta Ads Content */}
        {activeTab === 'meta' && renderMetaSection()}

        {/* Shopify Content */}
        {activeTab === 'shopify' && renderShopifySection()}

        {/* Google Ads Content (Coming Soon) */}
        {activeTab === 'google-ads' && (
          <div className="flex items-center justify-center py-12 text-surface-400">
            <div className="text-center">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Google Ads komt binnenkort</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
