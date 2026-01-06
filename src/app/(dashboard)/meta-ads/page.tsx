'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { MetaKPICards } from '@/components/meta-ads/kpi-cards'
import { MetaPerformanceTable } from '@/components/meta-ads/performance-table'
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker'
import {
  FilterToolbar,
  type FilterState,
  defaultFilters,
  applyFilters,
} from '@/components/meta-ads/filter-toolbar'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'
import {
  Facebook,
  RefreshCw,
  Loader2,
  Settings,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Brain,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import type {
  MetaDashboardKPIs,
  MetaPerformanceRow,
  MetaEntityType,
  MetaPerformanceResponse,
  MetaPerformanceTargets,
} from '@/types/meta-ads'

// Default empty KPIs
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
  cpa_change: 0,
  active_campaigns: 0,
  active_adsets: 0,
  active_ads: 0,
  fatigued_ads: 0,
}

// Default date range: last 7 days
const defaultDateRange: DateRange = {
  from: startOfDay(subDays(new Date(), 6)),
  to: endOfDay(new Date()),
}

export default function MetaAdsDashboard() {
  const selectedClientId = useSelectedClientId()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<MetaDashboardKPIs>(emptyKPIs)
  const [targets, setTargets] = useState<MetaPerformanceTargets>({})
  const [data, setData] = useState<MetaPerformanceRow[]>([])
  const [entityType, setEntityType] = useState<MetaEntityType>('ad')
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange)
  const [compareRange, setCompareRange] = useState<DateRange | null>(null)
  const [sortBy, setSortBy] = useState('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  // Apply client-side filters to data
  const filteredData = useMemo(() => {
    return applyFilters(data, filters)
  }, [data, filters])

  // Fetch data
  useEffect(() => {
    if (!selectedClientId) {
      setLoading(false)
      return
    }

    fetchData()
  }, [selectedClientId, entityType, dateRange, sortBy, sortOrder])

  const fetchData = async () => {
    if (!selectedClientId) return

    setLoading(true)
    setError(null)

    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd')
      const endDate = format(dateRange.to, 'yyyy-MM-dd')

      const params = new URLSearchParams({
        clientId: selectedClientId,
        entityType,
        dateStart: startDate,
        dateEnd: endDate,
        sortBy,
        sortOrder,
      })

      // Add compare range if set
      if (compareRange) {
        params.set('compareStart', format(compareRange.from, 'yyyy-MM-dd'))
        params.set('compareEnd', format(compareRange.to, 'yyyy-MM-dd'))
      }

      const response = await fetch(`/api/meta-ads/performance?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 400 && errorData.error?.includes('not configured')) {
          setIsConfigured(false)
          return
        }
        throw new Error(errorData.error || 'Failed to fetch data')
      }

      const result = await response.json() as MetaPerformanceResponse & { targets?: MetaPerformanceTargets }
      setKpis(result.kpis)
      setTargets(result.targets || {})
      // Transform data to include required fields with defaults
      const transformedData = result.data.map((row) => ({
        ...row,
        conversion_value: row.conversion_value ?? 0,
        cost_per_conversion: row.cost_per_conversion ?? 0,
        has_fatigue: row.has_fatigue ?? row.has_fatigue_warning ?? false,
      }))
      setData(transformedData)
      setIsConfigured(true)
    } catch (err) {
      console.error('Failed to fetch Meta Ads data:', err)
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
        body: JSON.stringify({
          clientId: selectedClientId,
          dateStart: format(dateRange.from, 'yyyy-MM-dd'),
          dateEnd: format(dateRange.to, 'yyyy-MM-dd'),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

      setLastSyncAt(new Date().toISOString())
      // Refresh data after sync
      await fetchData()
    } catch (err) {
      console.error('Sync failed:', err)
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleSort = (column: string, order: 'asc' | 'desc') => {
    setSortBy(column)
    setSortOrder(order)
  }

  const handleExport = async (exportFormat: 'csv' | 'excel') => {
    setExporting(true)
    try {
      const options = {
        dateRange,
        entityType,
        filename: `meta-ads-${entityType}s`,
      }

      if (exportFormat === 'csv') {
        exportToCSV(filteredData, options)
      } else {
        exportToExcel(filteredData, options)
      }
    } finally {
      setTimeout(() => setExporting(false), 500)
    }
  }

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)
  }

  const handleCompareChange = (range: DateRange | null) => {
    setCompareRange(range)
  }

  // Not configured state
  if (isConfigured === false) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <div className="w-16 h-16 bg-[#1877F2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Facebook className="h-8 w-8 text-[#1877F2]" />
          </div>
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Meta Ads nog niet geconfigureerd
          </h2>
          <p className="text-surface-600 mb-6 max-w-md mx-auto">
            Koppel je Meta Ads account om performance data te zien, creative fatigue te detecteren
            en AI-inzichten te ontvangen.
          </p>
          <Link href={`/clients/${selectedClientId}`}>
            <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90">
              <Settings className="h-4 w-4 mr-2" />
              Meta Ads Configureren
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // No client selected
  if (!selectedClientId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Selecteer een klant
          </h2>
          <p className="text-surface-600">
            Selecteer een klant in de header om Meta Ads data te bekijken.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1877F2]/10 rounded-lg flex items-center justify-center">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Meta Ads</h1>
            <p className="text-sm text-surface-500">
              Facebook & Instagram Ads Performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Date Range Picker */}
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            compareValue={compareRange}
            onCompareChange={handleCompareChange}
            showCompare={true}
            maxDate={new Date()}
          />

          {/* Sync Button */}
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Data
          </Button>

          {/* Settings Link */}
          <Link href={`/clients/${selectedClientId}`}>
            <Button variant="ghost" size="sm" className="p-2">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/meta-ads/performance">
          <div className="bg-white rounded-lg border border-surface-200 p-4 hover:border-[#1877F2] hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">Performance</p>
                <p className="text-xs text-surface-500">Uitgebreide analyse</p>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/meta-ads/fatigue">
          <div className="bg-white rounded-lg border border-surface-200 p-4 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">Creative Fatigue</p>
                <p className="text-xs text-surface-500">
                  {kpis.fatigued_ads > 0 ? `${kpis.fatigued_ads} waarschuwingen` : 'Alles OK'}
                </p>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/meta-ads/insights">
          <div className="bg-white rounded-lg border border-surface-200 p-4 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">AI Inzichten</p>
                <p className="text-xs text-surface-500">Automatische analyse</p>
              </div>
            </div>
          </div>
        </Link>
        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-surface-900">Periode</p>
              <p className="text-xs text-surface-500">
                {format(dateRange.from, 'd MMM')} - {format(dateRange.to, 'd MMM yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Er ging iets mis</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <MetaKPICards kpis={kpis} targets={targets} loading={loading} />

      {/* Entity Type Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200">
        {[
          { type: 'campaign' as MetaEntityType, label: 'Campaigns' },
          { type: 'adset' as MetaEntityType, label: 'Ad Sets' },
          { type: 'ad' as MetaEntityType, label: 'Ads' },
        ].map((tab) => (
          <button
            key={tab.type}
            onClick={() => setEntityType(tab.type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              entityType === tab.type
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-surface-500 hover:text-surface-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <FilterToolbar
        filters={filters}
        onFiltersChange={setFilters}
        data={data}
        entityType={entityType}
        onExport={handleExport}
        isExporting={exporting}
      />

      {/* Results count */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-surface-500">
          <span>
            {filteredData.length} {filteredData.length === 1 ? 'resultaat' : 'resultaten'}
            {filteredData.length !== data.length && ` (van ${data.length} totaal)`}
          </span>
          {lastSyncAt && (
            <span>
              Laatste sync: {format(new Date(lastSyncAt), 'd MMM HH:mm')}
            </span>
          )}
        </div>
      )}

      {/* Performance Table */}
      <MetaPerformanceTable
        data={filteredData}
        entityType={entityType}
        loading={loading}
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  )
}
