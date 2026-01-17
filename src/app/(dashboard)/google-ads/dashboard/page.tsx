'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useClientStore } from '@/stores/client-store'
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  MousePointer,
  Eye,
  Percent,
  BarChart3,
  Megaphone,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type KPIStatus = 'positive' | 'neutral' | 'warning' | 'negative'
type ComparisonMode = 'today_vs_yesterday' | 'last_7_vs_previous_7' | 'mtd_vs_previous_month'
type BreakdownDimension = 'campaign' | 'campaign_type' | 'brand_nonbrand' | 'device'

interface KPIData {
  value: number
  previousValue: number
  change: number
  changePercent: number
  status: KPIStatus
  formatted: string
  previousFormatted: string
}

interface DashboardData {
  period: {
    current: { start: string; end: string }
    previous: { start: string; end: string }
  }
  kpis: {
    spend: KPIData
    conversions: KPIData
    cpa: KPIData
    roas: KPIData
    conversionRate: KPIData
    clicks: KPIData
    impressions: KPIData
    ctr: KPIData
  }
  accountName: string
  currency: string
  lastUpdated: string
}

interface PerformanceData {
  comparisonMode: ComparisonMode
  period: {
    current: { start: string; end: string; label: string }
    previous: { start: string; end: string; label: string }
  }
  totals: {
    current: { cost: number; conversions: number; conversionsValue: number; clicks: number; impressions: number; cpa: number; roas: number; ctr: number; cvr: number }
    previous: { cost: number; conversions: number; conversionsValue: number; clicks: number; impressions: number; cpa: number; roas: number; ctr: number; cvr: number }
    change: {
      spendPercent: number
      conversionsPercent: number
      cpaPercent: number
      roasPercent: number
    }
  }
  autoHighlight: string | null
  winners?: Array<{
    id: string
    name: string
    change: { conversions: number; conversionsPercent: number }
    impact: number
  }>
  losers?: Array<{
    id: string
    name: string
    change: { conversions: number; conversionsPercent: number }
    impact: number
  }>
}

const STATUS_COLORS: Record<KPIStatus, string> = {
  positive: 'text-green-600 bg-green-50',
  neutral: 'text-surface-600 bg-surface-50',
  warning: 'text-orange-600 bg-orange-50',
  negative: 'text-red-600 bg-red-50',
}

const STATUS_ICONS = {
  positive: ArrowUpRight,
  neutral: Minus,
  warning: ArrowDownRight,
  negative: ArrowDownRight,
}

const COMPARISON_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: 'today_vs_yesterday', label: 'Vandaag vs Gisteren' },
  { value: 'last_7_vs_previous_7', label: 'Laatste 7 dagen vs vorige 7 dagen' },
  { value: 'mtd_vs_previous_month', label: 'MTD vs vorige maand' },
]

const BREAKDOWN_OPTIONS: { value: BreakdownDimension; label: string }[] = [
  { value: 'campaign', label: 'Campagne' },
  { value: 'campaign_type', label: 'Campagne type' },
  { value: 'brand_nonbrand', label: 'Brand vs Non-brand' },
  { value: 'device', label: 'Device' },
]

function KPICard({
  title,
  icon: Icon,
  data,
  isLowerBetter = false,
}: {
  title: string
  icon: React.ElementType
  data: KPIData
  isLowerBetter?: boolean
}) {
  const StatusIcon = STATUS_ICONS[data.status]
  const isPositiveChange = isLowerBetter
    ? data.changePercent < 0
    : data.changePercent > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-surface-500">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              STATUS_COLORS[data.status]
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {data.changePercent > 0 && '+'}
            {data.changePercent.toFixed(1)}%
          </div>
        </div>
        <p className="text-2xl font-bold text-surface-900">{data.formatted}</p>
        <p className="text-xs text-surface-500 mt-1">
          Was {data.previousFormatted}
        </p>
      </CardContent>
    </Card>
  )
}

export default function GoogleAdsDashboardPage() {
  const { selectedClient } = useClientStore()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('last_7_vs_previous_7')
  const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>('campaign')

  const fetchData = async () => {
    if (!selectedClient) return

    setLoading(true)
    setError(null)

    try {
      // Fetch dashboard KPIs
      const dashboardRes = await fetch(
        `/api/clients/${selectedClient.id}/google-ads/dashboard`
      )
      const dashboardJson = await dashboardRes.json()

      if (!dashboardJson.success) {
        throw new Error(dashboardJson.error || 'Failed to fetch dashboard')
      }

      setDashboardData(dashboardJson.data)

      // Fetch performance data with breakdown
      const performanceRes = await fetch(
        `/api/clients/${selectedClient.id}/google-ads/performance?mode=${comparisonMode}&breakdown=${breakdownDimension}`
      )
      const performanceJson = await performanceRes.json()

      if (!performanceJson.success) {
        throw new Error(performanceJson.error || 'Failed to fetch performance')
      }

      setPerformanceData(performanceJson.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedClient, comparisonMode, breakdownDimension])

  if (!selectedClient) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <Megaphone className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Selecteer een klant
            </h3>
            <p className="text-surface-600">
              Selecteer een klant in het menu om het Google Ads dashboard te bekijken.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const googleAdsConfigured = selectedClient.settings?.googleAds?.customerId

  if (!googleAdsConfigured) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <Megaphone className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Google Ads niet geconfigureerd
            </h3>
            <p className="text-surface-600 mb-4">
              Configureer eerst de Google Ads koppeling voor {selectedClient.name}.
            </p>
            <Link href={`/clients/${selectedClient.id}?tab=settings`}>
              <Button>Configureer Google Ads</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12 border-red-200 bg-red-50">
          <CardContent>
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Kon data niet laden
            </h3>
            <p className="text-surface-600 mb-4">{error}</p>
            <Button onClick={fetchData}>Opnieuw proberen</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-brand">
              <Megaphone className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">
                Google Ads Dashboard
              </h1>
              <p className="text-surface-600">
                {dashboardData?.accountName} &bull; Laatste 7 dagen vs vorige 7 dagen
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/alerts?channel=google_ads">
            <Button variant="outline" size="sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Bekijk alerts
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Auto Highlight */}
      {performanceData?.autoHighlight && (
        <Card className={cn(
          'border-l-4',
          performanceData.autoHighlight.includes('-')
            ? 'border-l-red-500 bg-red-50'
            : 'border-l-green-500 bg-green-50'
        )}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {performanceData.autoHighlight.includes('-') ? (
                <TrendingDown className="h-5 w-5 text-red-600" />
              ) : (
                <TrendingUp className="h-5 w-5 text-green-600" />
              )}
              <p className={cn(
                'font-medium',
                performanceData.autoHighlight.includes('-')
                  ? 'text-red-900'
                  : 'text-green-900'
              )}>
                {performanceData.autoHighlight}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Uitgaven"
            icon={DollarSign}
            data={dashboardData.kpis.spend}
            isLowerBetter={true}
          />
          <KPICard
            title="Conversies"
            icon={Target}
            data={dashboardData.kpis.conversions}
          />
          <KPICard
            title="CPA"
            icon={TrendingDown}
            data={dashboardData.kpis.cpa}
            isLowerBetter={true}
          />
          <KPICard
            title="ROAS"
            icon={TrendingUp}
            data={dashboardData.kpis.roas}
          />
        </div>
      )}

      {/* Secondary KPIs */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Clicks"
            icon={MousePointer}
            data={dashboardData.kpis.clicks}
          />
          <KPICard
            title="Impressies"
            icon={Eye}
            data={dashboardData.kpis.impressions}
          />
          <KPICard
            title="CTR"
            icon={Percent}
            data={dashboardData.kpis.ctr}
          />
          <KPICard
            title="Conversie ratio"
            icon={BarChart3}
            data={dashboardData.kpis.conversionRate}
          />
        </div>
      )}

      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Performance Analyse
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={comparisonMode}
                onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
                className="text-sm px-3 py-1.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {COMPARISON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={breakdownDimension}
                onChange={(e) => setBreakdownDimension(e.target.value as BreakdownDimension)}
                className="text-sm px-3 py-1.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {BREAKDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {performanceData && (
            <div className="space-y-6">
              {/* Period comparison */}
              <div className="flex items-center gap-4 text-sm text-surface-600">
                <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                  {performanceData.period.current.label}
                </span>
                <span>vs</span>
                <span className="px-2 py-1 bg-surface-100 rounded">
                  {performanceData.period.previous.label}
                </span>
              </div>

              {/* Winners & Losers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Winners */}
                <div>
                  <h4 className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Top stijgers
                  </h4>
                  <div className="space-y-2">
                    {performanceData.winners && performanceData.winners.length > 0 ? (
                      performanceData.winners.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                        >
                          <span className="text-sm font-medium text-surface-900 truncate max-w-[60%]">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-600">
                              +{item.change.conversions.toFixed(1)} conv
                            </span>
                            <Badge variant="primary" className="text-xs">
                              +{item.change.conversionsPercent.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-surface-500 italic">
                        Geen significante stijgingen
                      </p>
                    )}
                  </div>
                </div>

                {/* Losers */}
                <div>
                  <h4 className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Grootste dalers
                  </h4>
                  <div className="space-y-2">
                    {performanceData.losers && performanceData.losers.length > 0 ? (
                      performanceData.losers.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                        >
                          <span className="text-sm font-medium text-surface-900 truncate max-w-[60%]">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-600">
                              {item.change.conversions.toFixed(1)} conv
                            </span>
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">
                              {item.change.conversionsPercent.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-surface-500 italic">
                        Geen significante dalingen
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/google-ads/performance">
          <Card variant="interactive" className="h-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">Performance Details</p>
                  <p className="text-xs text-surface-500">Volledige breakdown en analyse</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/google-ads/pmax">
          <Card variant="interactive" className="h-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">Performance Max</p>
                  <p className="text-xs text-surface-500">Asset groups en signalen</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/google-ads/insights">
          <Card variant="interactive" className="h-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">AI Insights</p>
                  <p className="text-xs text-surface-500">Automatische optimalisatie tips</p>
                </div>
              </div>
              <Badge variant="warning" className="text-xs">Nieuw</Badge>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
