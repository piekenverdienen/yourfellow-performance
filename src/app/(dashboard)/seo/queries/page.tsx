'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Filter,
  Download,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'
import type {
  SearchConsoleQuery,
  QueryFilters,
  QuerySortField,
  SortOrder,
  QueryAggregates,
} from '@/types/search-console'

type DatePreset = '7d' | '28d' | '90d'

interface FilterConfig {
  key: keyof QueryFilters
  label: string
  isNew?: boolean
}

const FILTERS: FilterConfig[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'hasRelevantPage', label: 'Has Relevant Page' },
  { key: 'isQuestion', label: 'Questions' },
  { key: 'isBuyerKeyword', label: 'Buyer Keywords' },
  { key: 'isComparisonKeyword', label: 'Comparison Keywords', isNew: true },
  { key: 'isBranded', label: 'Branded' },
  { key: 'nonBranded', label: 'Non-Branded' },
  { key: 'noMentions', label: 'No Mentions' },
  { key: 'noClicks', label: 'No Clicks' },
]

const POSITION_FILTERS = [
  { label: 'On Page 2', positionMin: 11, positionMax: 20 },
  { label: 'Best Position < 10', positionMax: 10 },
  { label: 'Best Position > 10', positionMin: 10 },
]

const IMPRESSION_FILTERS = [
  { label: 'Impressions > 500', minImpressions: 500 },
  { label: 'Impressions > 100', minImpressions: 100 },
]

export default function QueriesPage() {
  const router = useRouter()
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id
  const siteUrl = selectedClient?.settings?.searchConsole?.siteUrl

  // DEBUG: Log what client and siteUrl we're using
  console.log('🔍 DEBUG QueriesPage:', {
    clientName: selectedClient?.name,
    clientId,
    siteUrl,
    allSettings: selectedClient?.settings,
  })

  // State
  const [queries, setQueries] = useState<SearchConsoleQuery[]>([])
  const [aggregates, setAggregates] = useState<QueryAggregates | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [positionFilter, setPositionFilter] = useState<{ min?: number; max?: number } | null>(null)
  const [impressionFilter, setImpressionFilter] = useState<number | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>('28d')

  // Sorting
  const [sortBy, setSortBy] = useState<QuerySortField>('uniqueImpressions')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Pagination
  const [offset, setOffset] = useState(0)
  const limit = 100

  // Fetch queries
  const fetchQueries = useCallback(async () => {
    if (!clientId) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        clientId,
        sortBy,
        sortOrder,
        limit: limit.toString(),
        offset: offset.toString(),
      })

      // Add search
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      // Add boolean filters
      Array.from(activeFilters).forEach(filter => {
        params.set(filter, 'true')
      })

      // Add position filter
      if (positionFilter?.min) {
        params.set('positionMin', positionFilter.min.toString())
      }
      if (positionFilter?.max) {
        params.set('positionMax', positionFilter.max.toString())
      }

      // Add impression filter
      if (impressionFilter) {
        params.set('minImpressions', impressionFilter.toString())
      }

      const response = await fetch(`/api/search-console/queries?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch queries')
      }

      setQueries(data.queries)
      setTotal(data.total)
      setAggregates(data.aggregates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [clientId, searchQuery, activeFilters, positionFilter, impressionFilter, sortBy, sortOrder, offset])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchQueries()
  }, [fetchQueries])

  // Sync data
  const handleSync = async () => {
    if (!clientId || !siteUrl) return

    // DEBUG: Log what we're syncing
    console.log('🚀 DEBUG handleSync:', {
      clientName: selectedClient?.name,
      clientId,
      siteUrl,
    })

    setIsSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/search-console/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          siteUrl,
          dateRangeDays: datePreset === '7d' ? 7 : datePreset === '90d' ? 90 : 28,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSyncResult(`Sync voltooid: ${data.queriesAdded} nieuwe, ${data.queriesUpdated} bijgewerkt`)
        fetchQueries()
      } else {
        setSyncResult(`Sync mislukt: ${data.errors?.[0] || 'Unknown error'}`)
      }
    } catch (err) {
      setSyncResult(`Sync fout: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Toggle filter
  const toggleFilter = (filterKey: string) => {
    const newFilters = new Set(activeFilters)
    if (newFilters.has(filterKey)) {
      newFilters.delete(filterKey)
    } else {
      // Handle mutually exclusive filters
      if (filterKey === 'isBranded') newFilters.delete('nonBranded')
      if (filterKey === 'nonBranded') newFilters.delete('isBranded')
      newFilters.add(filterKey)
    }
    setActiveFilters(newFilters)
    setOffset(0)
  }

  // Toggle position filter
  const togglePositionFilter = (min?: number, max?: number) => {
    if (positionFilter?.min === min && positionFilter?.max === max) {
      setPositionFilter(null)
    } else {
      setPositionFilter({ min, max })
    }
    setOffset(0)
  }

  // Toggle impression filter
  const toggleImpressionFilter = (value: number) => {
    if (impressionFilter === value) {
      setImpressionFilter(null)
    } else {
      setImpressionFilter(value)
    }
    setOffset(0)
  }

  // Sort handler
  const handleSort = (field: QuerySortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setOffset(0)
  }

  // Toggle watching
  const toggleWatching = async (query: SearchConsoleQuery) => {
    try {
      const response = await fetch(`/api/search-console/queries/${query.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWatching: !query.isWatching }),
      })

      if (response.ok) {
        setQueries(queries.map(q =>
          q.id === query.id ? { ...q, isWatching: !q.isWatching } : q
        ))
      }
    } catch (err) {
      console.error('Failed to toggle watching:', err)
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ['Query', 'Impressions', 'Clicks', 'CTR', 'Position', 'Pages', 'Mentions', 'Question', 'Buyer', 'Branded']
    const rows = queries.map(q => [
      `"${q.query.replace(/"/g, '""')}"`,
      q.uniqueImpressions,
      q.totalClicks,
      `${((q.averageCtr || 0) * 100).toFixed(2)}%`,
      q.bestPosition?.toFixed(1) || '-',
      q.pageCount,
      q.mentionCount,
      q.isQuestion ? 'Yes' : 'No',
      q.isBuyerKeyword ? 'Yes' : 'No',
      q.isBranded ? 'Yes' : 'No',
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `queries-${selectedClient?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // No client selected
  if (!selectedClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-12 w-12 text-surface-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen client geselecteerd</h3>
            <p className="text-surface-600">Selecteer eerst een client om queries te bekijken.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No Search Console configured
  if (!siteUrl) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Settings className="h-12 w-12 text-surface-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">Search Console niet geconfigureerd</h3>
            <p className="text-surface-600 mb-4">
              Configureer Search Console in de client instellingen om queries te bekijken.
            </p>
            <Button onClick={() => router.push(`/clients/${clientId}?tab=settings`)}>
              Ga naar instellingen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600">
                <Search className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-surface-900">Queries</h1>
              <Badge variant="secondary">{selectedClient.name}</Badge>
            </div>
            <p className="text-surface-600">
              Alle search queries voor {siteUrl}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Preset */}
            <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-1">
              {(['7d', '28d', '90d'] as DatePreset[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    datePreset === preset
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-600 hover:text-surface-900'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={exportCSV}
              disabled={queries.length === 0}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>

            <Button
              onClick={handleSync}
              isLoading={isSyncing}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Sync Data
            </Button>
          </div>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className={cn(
            'mt-4 p-3 rounded-lg flex items-center gap-2 text-sm',
            syncResult.includes('voltooid')
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          )}>
            {syncResult.includes('voltooid') ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {syncResult}
          </div>
        )}
      </div>

      {/* Stats */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <StatCard label="Queries" value={aggregates.totalQueries.toLocaleString()} />
          <StatCard label="Impressies" value={formatNumber(aggregates.totalImpressions)} />
          <StatCard label="Clicks" value={formatNumber(aggregates.totalClicks)} />
          <StatCard label="Gem. Positie" value={aggregates.averagePosition.toFixed(1)} />
          <StatCard label="Watching" value={aggregates.watchingCount} highlight />
          <StatCard label="Zonder Mentions" value={aggregates.noMentionsCount} />
        </div>
      )}

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Zoek naar een query..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setOffset(0)
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Toggle Filters */}
          <div className="mb-3">
            <p className="text-sm font-medium text-surface-600 mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Toggle Filters
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(filter => (
                <FilterButton
                  key={filter.key}
                  active={activeFilters.has(filter.key)}
                  onClick={() => toggleFilter(filter.key)}
                  isNew={filter.isNew}
                >
                  {filter.label}
                </FilterButton>
              ))}

              {POSITION_FILTERS.map(pf => (
                <FilterButton
                  key={pf.label}
                  active={positionFilter?.min === pf.positionMin && positionFilter?.max === pf.positionMax}
                  onClick={() => togglePositionFilter(pf.positionMin, pf.positionMax)}
                >
                  {pf.label}
                </FilterButton>
              ))}

              {IMPRESSION_FILTERS.map(imf => (
                <FilterButton
                  key={imf.label}
                  active={impressionFilter === imf.minImpressions}
                  onClick={() => toggleImpressionFilter(imf.minImpressions)}
                >
                  {imf.label}
                </FilterButton>
              ))}

              {(activeFilters.size > 0 || positionFilter || impressionFilter) && (
                <button
                  onClick={() => {
                    setActiveFilters(new Set())
                    setPositionFilter(null)
                    setImpressionFilter(null)
                    setOffset(0)
                  }}
                  className="text-sm text-surface-500 hover:text-surface-700 underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Fout bij ophalen data</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Search Console Queries ({total.toLocaleString()})
              </CardTitle>
              <CardDescription>
                Klik op een kolom om te sorteren
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-8 w-8 text-surface-400 mx-auto mb-4 animate-spin" />
              <p className="text-surface-600">Queries laden...</p>
            </div>
          ) : queries.length === 0 ? (
            <div className="py-16 text-center">
              <Search className="h-12 w-12 text-surface-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-surface-900 mb-2">Geen queries gevonden</h3>
              <p className="text-surface-600 mb-4">
                {total === 0
                  ? 'Klik op "Sync Data" om Search Console data op te halen.'
                  : 'Pas je filters aan om resultaten te zien.'}
              </p>
              {total === 0 && (
                <Button onClick={handleSync} isLoading={isSyncing}>
                  Sync Data
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-y border-surface-200">
                  <tr>
                    <th className="w-10 py-3 px-3">
                      <Eye className="h-4 w-4 text-surface-400" />
                    </th>
                    <SortableHeader
                      label="Query"
                      field="query"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      align="left"
                    />
                    <th className="text-center py-3 px-2 font-medium text-surface-600 w-16">Pages</th>
                    <th className="text-center py-3 px-2 font-medium text-surface-600 w-20">Mentions</th>
                    <SortableHeader
                      label="Impressies"
                      field="uniqueImpressions"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Positie"
                      field="bestPosition"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Clicks"
                      field="totalClicks"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="CTR"
                      field="averageCtr"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="text-center py-3 px-3 font-medium text-surface-600 w-16">Watch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {queries.map((query) => (
                    <tr key={query.id} className="hover:bg-surface-50">
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => toggleWatching(query)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            query.isWatching
                              ? 'text-primary hover:text-primary/80'
                              : 'text-surface-300 hover:text-surface-500'
                          )}
                        >
                          {query.isWatching ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-medium',
                            query.mentionCount === 0 && 'text-orange-600'
                          )}>
                            {query.query}
                          </span>
                          {query.isQuestion && (
                            <Badge variant="outline" className="text-xs">?</Badge>
                          )}
                          {query.isBuyerKeyword && (
                            <Badge className="text-[10px] py-0 px-1 bg-green-100 text-green-700">Buyer</Badge>
                          )}
                          {query.isBranded && (
                            <Badge className="text-[10px] py-0 px-1 bg-purple-100 text-purple-700">Brand</Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-2 text-surface-600">
                        {query.pageCount}
                      </td>
                      <td className="text-center py-2.5 px-2">
                        <span className={cn(
                          'inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium',
                          query.mentionCount === 0
                            ? 'bg-orange-100 text-orange-700'
                            : query.mentionCount >= 3
                              ? 'bg-green-100 text-green-700'
                              : 'bg-surface-100 text-surface-600'
                        )}>
                          {query.mentionCount}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-2 text-surface-600">
                        {query.uniqueImpressions.toLocaleString()}
                      </td>
                      <td className="text-right py-2.5 px-2">
                        <span className={cn(
                          'font-medium',
                          query.bestPosition && query.bestPosition <= 3 ? 'text-green-600' :
                            query.bestPosition && query.bestPosition <= 10 ? 'text-blue-600' :
                              query.bestPosition && query.bestPosition <= 20 ? 'text-orange-600' : 'text-surface-500'
                        )}>
                          {query.bestPosition?.toFixed(1) || '-'}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-2 text-surface-600">
                        {query.totalClicks.toLocaleString()}
                      </td>
                      <td className="text-right py-2.5 px-3 text-surface-500">
                        {((query.averageCtr || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <button
                          onClick={() => toggleWatching(query)}
                          className={cn(
                            'p-1.5 rounded-full transition-colors',
                            query.isWatching
                              ? 'bg-green-100 text-green-600'
                              : 'bg-surface-100 text-surface-400 hover:bg-surface-200'
                          )}
                        >
                          {query.isWatching ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > limit && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 bg-surface-50">
                  <p className="text-sm text-surface-600">
                    Toont {offset + 1} - {Math.min(offset + limit, total)} van {total.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                    >
                      Vorige
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(offset + limit)}
                      disabled={offset + limit >= total}
                    >
                      Volgende
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Helper Components

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <p className={cn('text-2xl font-bold', highlight ? 'text-primary' : 'text-surface-900')}>
          {value}
        </p>
        <p className="text-xs text-surface-500">{label}</p>
      </CardContent>
    </Card>
  )
}

function FilterButton({
  active,
  onClick,
  children,
  isNew,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  isNew?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300 hover:bg-surface-50'
      )}
    >
      {children}
      {isNew && (
        <Badge className="absolute -top-2 -right-2 text-[10px] py-0 px-1.5 bg-green-500 text-white">
          New!
        </Badge>
      )}
    </button>
  )
}

function SortableHeader({
  label,
  field,
  currentSort,
  sortOrder,
  onSort,
  align = 'right',
}: {
  label: string
  field: QuerySortField
  currentSort: QuerySortField
  sortOrder: SortOrder
  onSort: (field: QuerySortField) => void
  align?: 'left' | 'right'
}) {
  const isActive = currentSort === field

  return (
    <th
      className={cn(
        'py-3 px-2 font-medium text-surface-600 cursor-pointer hover:text-surface-900 transition-colors',
        align === 'left' ? 'text-left' : 'text-right'
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          sortOrder === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        )}
      </span>
    </th>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}
