'use client'

import * as React from 'react'
import {
  Search,
  Filter,
  Download,
  X,
  ChevronDown,
  Check,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetaPerformanceRow, MetaEntityType } from '@/types/meta-ads'

export interface FilterState {
  search: string
  status: ('active' | 'paused' | 'archived' | 'all')[]
  minSpend: number | null
  maxSpend: number | null
  minROAS: number | null
  maxROAS: number | null
  fatigueOnly: boolean
}

interface FilterToolbarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  data: MetaPerformanceRow[]
  entityType: MetaEntityType
  onExport: (format: 'csv' | 'excel') => void
  isExporting?: boolean
}

const statusOptions = [
  { value: 'active', label: 'Actief', color: 'bg-green-500' },
  { value: 'paused', label: 'Gepauzeerd', color: 'bg-amber-500' },
  { value: 'archived', label: 'Gearchiveerd', color: 'bg-surface-400' },
] as const

export const defaultFilters: FilterState = {
  search: '',
  status: [],
  minSpend: null,
  maxSpend: null,
  minROAS: null,
  maxROAS: null,
  fatigueOnly: false,
}

export function FilterToolbar({
  filters,
  onFiltersChange,
  data,
  entityType,
  onExport,
  isExporting,
}: FilterToolbarProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = React.useState(false)
  const [showExportDropdown, setShowExportDropdown] = React.useState(false)
  const statusRef = React.useRef<HTMLDivElement>(null)
  const exportRef = React.useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.status.length > 0) count++
    if (filters.minSpend !== null || filters.maxSpend !== null) count++
    if (filters.minROAS !== null || filters.maxROAS !== null) count++
    if (filters.fatigueOnly) count++
    return count
  }, [filters])

  const handleStatusToggle = (status: 'active' | 'paused' | 'archived') => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]
    onFiltersChange({ ...filters, status: newStatus })
  }

  const clearFilters = () => {
    onFiltersChange(defaultFilters)
    setShowAdvanced(false)
  }

  const entityLabel = {
    campaign: 'campaigns',
    adset: 'ad sets',
    ad: 'ads',
  }[entityType]

  return (
    <div className="space-y-3">
      {/* Main Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder={`Zoek ${entityLabel}...`}
            className={cn(
              'w-full pl-9 pr-4 py-2 bg-white border border-surface-200 rounded-lg',
              'text-sm text-surface-700 placeholder:text-surface-400',
              'focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]'
            )}
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div ref={statusRef} className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-lg',
              'text-sm font-medium text-surface-700',
              'hover:border-surface-300 transition-colors',
              filters.status.length > 0 && 'border-[#1877F2] bg-[#1877F2]/5'
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Status</span>
            {filters.status.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold bg-[#1877F2] text-white rounded-full">
                {filters.status.length}
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-surface-400" />
          </button>

          {showStatusDropdown && (
            <div className="absolute z-50 mt-1 w-48 bg-white border border-surface-200 rounded-lg shadow-lg py-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusToggle(option.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-50"
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center',
                      filters.status.includes(option.value)
                        ? 'bg-[#1877F2] border-[#1877F2]'
                        : 'border-surface-300'
                    )}
                  >
                    {filters.status.includes(option.value) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className={cn('w-2 h-2 rounded-full', option.color)} />
                  <span className="text-surface-700">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fatigue Only Toggle */}
        <button
          onClick={() => onFiltersChange({ ...filters, fatigueOnly: !filters.fatigueOnly })}
          className={cn(
            'flex items-center gap-2 px-3 py-2 border rounded-lg',
            'text-sm font-medium transition-colors',
            filters.fatigueOnly
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300'
          )}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Alleen fatigue
        </button>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-lg',
            'text-sm font-medium text-surface-700',
            'hover:border-surface-300 transition-colors',
            showAdvanced && 'border-[#1877F2] bg-[#1877F2]/5'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Geavanceerd</span>
        </button>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
            <span>Wis filters ({activeFilterCount})</span>
          </button>
        )}

        {/* Export Button */}
        <div ref={exportRef} className="relative ml-auto">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 bg-surface-900 text-white rounded-lg',
              'text-sm font-medium transition-colors',
              'hover:bg-surface-800',
              isExporting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'Exporteren...' : 'Exporteer'}</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showExportDropdown && !isExporting && (
            <div className="absolute z-50 mt-1 right-0 w-48 bg-white border border-surface-200 rounded-lg shadow-lg py-1">
              <button
                onClick={() => {
                  onExport('csv')
                  setShowExportDropdown(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-50"
              >
                <Download className="h-4 w-4 text-surface-500" />
                <span className="text-surface-700">Download CSV</span>
              </button>
              <button
                onClick={() => {
                  onExport('excel')
                  setShowExportDropdown(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-50"
              >
                <Download className="h-4 w-4 text-surface-500" />
                <span className="text-surface-700">Download Excel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="p-4 bg-surface-50 border border-surface-200 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Spend Range */}
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Min. Spend (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.minSpend ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minSpend: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Max. Spend (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.maxSpend ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    maxSpend: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="∞"
                className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
              />
            </div>

            {/* ROAS Range */}
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Min. ROAS
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.minROAS ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minROAS: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">
                Max. ROAS
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.maxROAS ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    maxROAS: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="∞"
                className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="mt-4 pt-4 border-t border-surface-200">
            <p className="text-xs font-medium text-surface-500 mb-2">Snelfilters</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onFiltersChange({ ...filters, minROAS: 2, maxROAS: null })}
                className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
              >
                ROAS {'>'}= 2
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minROAS: null, maxROAS: 1 })}
                className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
              >
                ROAS {'<'} 1
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minSpend: 100, maxSpend: null })}
                className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
              >
                Spend {'>'}= €100
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minSpend: null, maxSpend: 10 })}
                className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
              >
                Spend {'<'} €10
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to apply filters to data
export function applyFilters(
  data: MetaPerformanceRow[],
  filters: FilterState
): MetaPerformanceRow[] {
  return data.filter((row) => {
    // Search filter
    if (
      filters.search &&
      !row.entity_name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false
    }

    // Status filter
    if (filters.status.length > 0) {
      const rowStatus = row.status?.toLowerCase() || 'active'
      if (!filters.status.includes(rowStatus as 'active' | 'paused' | 'archived')) {
        return false
      }
    }

    // Spend range filter
    if (filters.minSpend !== null && row.spend < filters.minSpend) {
      return false
    }
    if (filters.maxSpend !== null && row.spend > filters.maxSpend) {
      return false
    }

    // ROAS range filter
    if (filters.minROAS !== null && row.roas < filters.minROAS) {
      return false
    }
    if (filters.maxROAS !== null && row.roas > filters.maxROAS) {
      return false
    }

    // Fatigue filter
    if (filters.fatigueOnly && !row.has_fatigue) {
      return false
    }

    return true
  })
}
