'use client'

import { useState, useEffect } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Calendar,
  Download,
  Filter,
} from 'lucide-react'
import type {
  MetaDashboardKPIs,
  MetaPerformanceRow,
  MetaEntityType,
  MetaPerformanceResponse,
} from '@/types/meta-ads'

const emptyKPIs: MetaDashboardKPIs = {
  total_spend: 0,
  total_impressions: 0,
  total_reach: 0,
  total_clicks: 0,
  total_conversions: 0,
  total_revenue: 0,
  avg_ctr: 0,
  avg_cpc: 0,
  avg_cpm: 0,
  avg_frequency: 0,
  avg_roas: 0,
  avg_cpa: 0,
  spend_change: 0,
  impressions_change: 0,
  clicks_change: 0,
  conversions_change: 0,
  roas_change: 0,
  active_campaigns: 0,
  active_adsets: 0,
  active_ads: 0,
  fatigued_ads: 0,
}

const TrendIcon = ({ value }: { value: number }) => {
  if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-surface-400" />
}

const TrendBadge = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
  const isPositive = inverse ? value < 0 : value > 0
  const isNegative = inverse ? value > 0 : value < 0

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        isPositive
          ? 'bg-green-100 text-green-700'
          : isNegative
          ? 'bg-red-100 text-red-700'
          : 'bg-surface-100 text-surface-600'
      }`}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

export default function MetaAdsPerformancePage() {
  const selectedClientId = useSelectedClientId()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<MetaDashboardKPIs>(emptyKPIs)
  const [data, setData] = useState<MetaPerformanceRow[]>([])
  const [entityType, setEntityType] = useState<MetaEntityType>('campaign')
  const [dateRange, setDateRange] = useState(30)
  const [sortBy, setSortBy] = useState('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (selectedClientId) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [selectedClientId, entityType, dateRange, sortBy, sortOrder])

  const fetchData = async () => {
    if (!selectedClientId) return

    setLoading(true)
    setError(null)

    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const params = new URLSearchParams({
        clientId: selectedClientId,
        entityType,
        dateStart: startDate,
        dateEnd: endDate,
        sortBy,
        sortOrder,
        pageSize: '100',
      })

      const response = await fetch(`/api/meta-ads/performance?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch data')
      }

      const result: MetaPerformanceResponse = await response.json()
      setKpis(result.kpis)
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    if (!selectedClientId) return

    setSyncing(true)
    try {
      const response = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('nl-NL').format(value)
  }

  if (!selectedClientId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Selecteer een klant
          </h2>
          <p className="text-surface-600">
            Selecteer een klant in de header om performance data te bekijken.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Performance Analyse</h1>
            <p className="text-sm text-surface-500">
              Gedetailleerde metrics en trends
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={e => setDateRange(parseInt(e.target.value))}
            className="appearance-none bg-white border border-surface-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-surface-700"
          >
            <option value={7}>Laatste 7 dagen</option>
            <option value={14}>Laatste 14 dagen</option>
            <option value={30}>Laatste 30 dagen</option>
            <option value={60}>Laatste 60 dagen</option>
            <option value={90}>Laatste 90 dagen</option>
          </select>

          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Er ging iets mis</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="text-sm text-surface-500 mb-1">Totale Spend</div>
          <div className="text-2xl font-bold text-surface-900">
            {loading ? '...' : formatCurrency(kpis.total_spend)}
          </div>
          <div className="mt-2">
            <TrendBadge value={kpis.spend_change} inverse />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="text-sm text-surface-500 mb-1">Conversies</div>
          <div className="text-2xl font-bold text-surface-900">
            {loading ? '...' : formatNumber(kpis.total_conversions)}
          </div>
          <div className="mt-2">
            <TrendBadge value={kpis.conversions_change} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="text-sm text-surface-500 mb-1">ROAS</div>
          <div className="text-2xl font-bold text-surface-900">
            {loading ? '...' : kpis.avg_roas.toFixed(2)}
          </div>
          <div className="mt-2">
            <TrendBadge value={kpis.roas_change} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="text-sm text-surface-500 mb-1">CPA</div>
          <div className="text-2xl font-bold text-surface-900">
            {loading ? '...' : formatCurrency(kpis.avg_cpa)}
          </div>
          <div className="mt-2 text-xs text-surface-500">
            {kpis.active_ads} actieve ads
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Impressies', value: formatNumber(kpis.total_impressions), change: kpis.impressions_change },
          { label: 'Bereik', value: formatNumber(kpis.total_reach), change: 0 },
          { label: 'Klikken', value: formatNumber(kpis.total_clicks), change: kpis.clicks_change },
          { label: 'CTR', value: `${kpis.avg_ctr.toFixed(2)}%`, change: 0 },
          { label: 'CPC', value: formatCurrency(kpis.avg_cpc), change: 0, inverse: true },
          { label: 'Frequency', value: kpis.avg_frequency.toFixed(2), change: 0, inverse: true },
        ].map((metric, i) => (
          <div key={i} className="bg-white rounded-lg border border-surface-200 p-3">
            <div className="text-xs text-surface-500 mb-1">{metric.label}</div>
            <div className="text-lg font-semibold text-surface-900">
              {loading ? '...' : metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Entity Type Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 border-b border-surface-200">
          {[
            { type: 'campaign' as MetaEntityType, label: 'Campaigns' },
            { type: 'adset' as MetaEntityType, label: 'Ad Sets' },
            { type: 'ad' as MetaEntityType, label: 'Ads' },
          ].map(tab => (
            <button
              key={tab.type}
              onClick={() => setEntityType(tab.type)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                entityType === tab.type
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-surface-600">
          <span>{data.length} items</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-surface-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-surface-500">
            Geen data beschikbaar voor deze periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Naam
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Spend
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Impressies
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Klikken
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    CTR
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    CPC
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Conv.
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    ROAS
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Freq.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.map((row, i) => (
                  <tr
                    key={row.entity_id}
                    className={`hover:bg-surface-50 ${
                      row.has_fatigue_warning ? 'bg-orange-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.has_fatigue_warning && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full" />
                        )}
                        <div>
                          <div className="font-medium text-surface-900 text-sm">
                            {row.entity_name}
                          </div>
                          {row.campaign_name && entityType !== 'campaign' && (
                            <div className="text-xs text-surface-500">
                              {row.campaign_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                          row.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-surface-100 text-surface-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-sm">
                          {formatCurrency(row.spend)}
                        </span>
                        <TrendIcon value={row.spend_trend === 'up' ? 1 : row.spend_trend === 'down' ? -1 : 0} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatNumber(row.impressions)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatNumber(row.clicks)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-sm">{row.ctr.toFixed(2)}%</span>
                        <TrendIcon value={row.ctr_trend === 'up' ? 1 : row.ctr_trend === 'down' ? -1 : 0} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatCurrency(row.cpc)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatNumber(row.conversions)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-sm">{row.roas.toFixed(2)}</span>
                        <TrendIcon value={row.roas_trend === 'up' ? 1 : row.roas_trend === 'down' ? -1 : 0} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm ${
                          row.frequency > 3
                            ? 'text-red-600 font-medium'
                            : row.frequency > 2.5
                            ? 'text-orange-600'
                            : ''
                        }`}
                      >
                        {row.frequency.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
