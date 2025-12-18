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
    return change > 0 ? (
      <TrendingUp className="h-3 w-3 text-green-500" />
    ) : (
      <TrendingDown className="h-3 w-3 text-red-500" />
    )
  }

  const getTrendColor = () => {
    if (change === undefined || change === 0) return 'text-surface-500'
    return change > 0 ? 'text-green-600' : 'text-red-600'
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
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Spend"
        value={kpis.total_spend}
        change={kpis.spend_change}
        icon={<DollarSign className="h-5 w-5 text-surface-600" />}
        format="currency"
        loading={loading}
      />
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
        title="ROAS"
        value={kpis.avg_roas}
        change={kpis.roas_change}
        icon={<TrendingUp className="h-5 w-5 text-surface-600" />}
        format="decimal"
        loading={loading}
      />
      <KPICard
        title="Fatigued Ads"
        value={kpis.fatigued_ads}
        icon={<Repeat className="h-5 w-5 text-amber-600" />}
        format="number"
        loading={loading}
        alert={kpis.fatigued_ads > 0}
        alertMessage={
          kpis.fatigued_ads > 0
            ? `${kpis.fatigued_ads} ads met hoge frequency`
            : undefined
        }
      />
    </div>
  )
}
