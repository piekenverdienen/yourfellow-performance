'use client'

import { cn } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  Repeat,
  AlertTriangle,
  ShoppingBag,
  BarChart3,
} from 'lucide-react'
import type { MetaDashboardKPIs } from '@/types/meta-ads'

interface KPICardsProps {
  kpis: MetaDashboardKPIs
  loading?: boolean
  currency?: string
}

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  format?: 'number' | 'currency' | 'percent' | 'decimal'
  loading?: boolean
  alert?: boolean
  alertMessage?: string
  invertTrend?: boolean // When true, negative change is good (e.g., CPA decrease)
}

function KPICard({
  title,
  value,
  change,
  icon,
  format = 'number',
  loading,
  alert,
  alertMessage,
  invertTrend = false,
}: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('nl-NL', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val)
      case 'percent':
        return `${val.toFixed(2)}%`
      case 'decimal':
        return val.toFixed(2)
      default:
        return new Intl.NumberFormat('nl-NL').format(val)
    }
  }

  const getTrendIcon = () => {
    if (change === undefined || change === 0) {
      return <Minus className="h-3 w-3 text-surface-400" />
    }
    // For inverted trends (like CPA), down is good
    const isPositive = invertTrend ? change < 0 : change > 0
    return isPositive ? (
      <TrendingUp className="h-3 w-3 text-green-500" />
    ) : (
      <TrendingDown className="h-3 w-3 text-red-500" />
    )
  }

  const getTrendColor = () => {
    if (change === undefined || change === 0) return 'text-surface-500'
    // For inverted trends (like CPA), down is good
    const isPositive = invertTrend ? change < 0 : change > 0
    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-surface-200 p-4 transition-all hover:shadow-md',
        alert && 'border-amber-300 bg-amber-50/50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-surface-500 font-medium">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-surface-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-surface-900 mt-1">
              {formatValue(value)}
            </p>
          )}
          {change !== undefined && !loading && (
            <div className={cn('flex items-center gap-1 mt-1', getTrendColor())}>
              {getTrendIcon()}
              <span className="text-xs font-medium">
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-surface-400">vs vorige periode</span>
            </div>
          )}
          {alert && alertMessage && (
            <div className="flex items-center gap-1 mt-2 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">{alertMessage}</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg',
            alert ? 'bg-amber-100' : 'bg-surface-100'
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

export function MetaKPICards({ kpis, loading, currency = 'EUR' }: KPICardsProps) {
  // Calculate if CPA is concerning (above 50 EUR threshold or increased significantly)
  const cpaAlert = kpis.avg_cpa > 50 || kpis.cpa_change > 25

  return (
    <div className="space-y-4">
      {/* Primary KPIs - Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Spend"
          value={kpis.total_spend}
          change={kpis.spend_change}
          icon={<DollarSign className="h-5 w-5 text-blue-600" />}
          format="currency"
          loading={loading}
        />
        <KPICard
          title="Conversies"
          value={kpis.total_conversions}
          change={kpis.conversions_change}
          icon={<ShoppingBag className="h-5 w-5 text-emerald-600" />}
          format="number"
          loading={loading}
        />
        <KPICard
          title="CPA"
          value={kpis.avg_cpa}
          change={kpis.cpa_change}
          icon={<Target className="h-5 w-5 text-purple-600" />}
          format="currency"
          loading={loading}
          invertTrend={true}
          alert={cpaAlert}
          alertMessage={cpaAlert ? 'CPA boven target' : undefined}
        />
        <KPICard
          title="ROAS"
          value={kpis.avg_roas}
          change={kpis.roas_change}
          icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
          format="decimal"
          loading={loading}
        />
      </div>

      {/* Secondary KPIs - Volume & Efficiency */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          title="Impressies"
          value={kpis.total_impressions}
          change={kpis.impressions_change}
          icon={<Eye className="h-5 w-5 text-surface-600" />}
          format="number"
          loading={loading}
        />
        <KPICard
          title="Clicks"
          value={kpis.total_clicks}
          change={kpis.clicks_change}
          icon={<MousePointer className="h-5 w-5 text-surface-600" />}
          format="number"
          loading={loading}
        />
        <KPICard
          title="CTR"
          value={kpis.avg_ctr}
          icon={<Target className="h-5 w-5 text-surface-600" />}
          format="percent"
          loading={loading}
        />
        <KPICard
          title="Frequentie"
          value={kpis.avg_frequency}
          icon={<Repeat className="h-5 w-5 text-surface-600" />}
          format="decimal"
          loading={loading}
          alert={kpis.avg_frequency > 3}
          alertMessage={kpis.avg_frequency > 3 ? 'Hoge frequentie' : undefined}
        />
        <KPICard
          title="Fatigue Alerts"
          value={kpis.fatigued_ads}
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          format="number"
          loading={loading}
          alert={kpis.fatigued_ads > 0}
          alertMessage={
            kpis.fatigued_ads > 0
              ? `${kpis.fatigued_ads} ads met fatigue`
              : undefined
          }
        />
      </div>
    </div>
  )
}
