'use client'

import { useState, useEffect } from 'react'
import { useSelectedClientId } from '@/stores/client-store'
import { MetaKPICards } from '@/components/meta-ads/kpi-cards'
import { MetaPerformanceTable } from '@/components/meta-ads/performance-table'
import { Button } from '@/components/ui/button'
import {
  Facebook,
  RefreshCw,
  Loader2,
  Settings,
  Calendar,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import type {
  MetaDashboardKPIs,
  MetaPerformanceRow,
  MetaEntityType,
  MetaPerformanceResponse,
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
  active_campaigns: 0,
  active_adsets: 0,
  active_ads: 0,
  fatigued_ads: 0,
}

// Date range options
const dateRanges = [
  { label: 'Laatste 7 dagen', days: 7 },
  { label: 'Laatste 14 dagen', days: 14 },
  { label: 'Laatste 30 dagen', days: 30 },
  { label: 'Deze maand', days: 0, type: 'month' },
]

export default function MetaAdsDashboard() {
  const selectedClientId = useSelectedClientId()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<MetaDashboardKPIs>(emptyKPIs)
  const [data, setData] = useState<MetaPerformanceRow[]>([])
  const [entityType, setEntityType] = useState<MetaEntityType>('ad')
  const [dateRange, setDateRange] = useState(7)
  const [sortBy, setSortBy] = useState('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)

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
      })

      const response = await fetch(`/api/meta-ads/performance?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 400 && errorData.error?.includes('not configured')) {
          setIsConfigured(false)
          return
        }
        throw new Error(errorData.error || 'Failed to fetch data')
      }

      const result: MetaPerformanceResponse = await response.json()
      setKpis(result.kpis)
      setData(result.data)
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
        body: JSON.stringify({ clientId: selectedClientId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sync failed')
      }

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
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(parseInt(e.target.value))}
              className="appearance-none bg-white border border-surface-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-surface-700 hover:border-surface-300 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
            >
              {dateRanges.map((range) => (
                <option key={range.days} value={range.days}>
                  {range.label}
                </option>
              ))}
            </select>
            <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
          </div>

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
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
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
      <MetaKPICards kpis={kpis} loading={loading} />

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

      {/* Performance Table */}
      <MetaPerformanceTable
        data={data}
        entityType={entityType}
        loading={loading}
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  )
}
