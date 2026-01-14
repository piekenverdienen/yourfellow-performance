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
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Sparkles,
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
  { value: 'active', label: 'Actief', color: 'bg-emerald-500', lightColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
  { value: 'paused', label: 'Gepauzeerd', color: 'bg-amber-500', lightColor: 'bg-amber-100', textColor: 'text-amber-700' },
  { value: 'archived', label: 'Gearchiveerd', color: 'bg-surface-400', lightColor: 'bg-surface-100', textColor: 'text-surface-600' },
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
  const searchRef = React.useRef<HTMLInputElement>(null)

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

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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
    account: 'accounts',
    campaign: 'campaigns',
    adset: 'ad sets',
    ad: 'ads',
  }[entityType]

  return (
    <div className="space-y-3">
      {/* Main Filter Row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 group-focus-within:text-[#1877F2] transition-colors" />
          <input
            ref={searchRef}
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder={`Zoek ${entityLabel}...`}
            className={cn(
              'w-full pl-10 pr-20 py-2.5 bg-white border border-surface-200 rounded-xl',
              'text-sm text-surface-700 placeholder:text-surface-400',
              'focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]',
              'transition-all duration-200'
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {filters.search ? (
              <button
                onClick={() => onFiltersChange({ ...filters, search: '' })}
                className="p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-md transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-surface-400 bg-surface-100 border border-surface-200 rounded">
                <span className="text-[9px]">⌘</span>K
              </kbd>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div ref={statusRef} className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-xl',
              'text-sm font-medium transition-all duration-200',
              'hover:border-surface-300',
              filters.status.length > 0
                ? 'border-[#1877F2] bg-[#1877F2]/5 text-[#1877F2]'
                : 'border-surface-200 text-surface-700'
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Status</span>
            {filters.status.length > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-[#1877F2] text-white rounded-full">
                {filters.status.length}
              </span>
            )}
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform duration-200',
              showStatusDropdown && 'rotate-180'
            )} />
          </button>

          {showStatusDropdown && (
            <div className="absolute z-50 mt-2 w-56 bg-white border border-surface-200 rounded-xl shadow-xl py-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <p className="px-3 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                Filter op status
              </p>
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusToggle(option.value)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-surface-50 transition-colors"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all',
                      filters.status.includes(option.value)
                        ? 'bg-[#1877F2] border-[#1877F2]'
                        : 'border-surface-300 bg-white'
                    )}
                  >
                    {filters.status.includes(option.value) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className={cn('w-2.5 h-2.5 rounded-full', option.color)} />
                  <span className="font-medium text-surface-700">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fatigue Only Toggle */}
        <button
          onClick={() => onFiltersChange({ ...filters, fatigueOnly: !filters.fatigueOnly })}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 border rounded-xl',
            'text-sm font-medium transition-all duration-200',
            filters.fatigueOnly
              ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
              : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300'
          )}
        >
          <AlertTriangle className={cn(
            'h-4 w-4',
            filters.fatigueOnly ? 'text-amber-600' : 'text-surface-400'
          )} />
          <span>Fatigue</span>
          {filters.fatigueOnly && (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-xl',
            'text-sm font-medium transition-all duration-200',
            'hover:border-surface-300',
            showAdvanced && 'border-[#1877F2] bg-[#1877F2]/5 text-[#1877F2]'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Geavanceerd</span>
          <ChevronDown className={cn(
            'h-4 w-4 transition-transform duration-200',
            showAdvanced && 'rotate-180'
          )} />
        </button>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <X className="h-4 w-4" />
            <span>Wis ({activeFilterCount})</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export Button */}
        <div ref={exportRef} className="relative">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'text-sm font-semibold transition-all duration-200',
              'bg-gradient-to-r from-surface-900 to-surface-800 text-white',
              'hover:from-surface-800 hover:to-surface-700 hover:shadow-lg',
              'active:scale-[0.98]',
              isExporting && 'opacity-60 cursor-not-allowed'
            )}
          >
            <Download className={cn('h-4 w-4', isExporting && 'animate-bounce')} />
            <span>{isExporting ? 'Bezig...' : 'Export'}</span>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform duration-200',
              showExportDropdown && 'rotate-180'
            )} />
          </button>

          {showExportDropdown && !isExporting && (
            <div className="absolute z-50 mt-2 right-0 w-52 bg-white border border-surface-200 rounded-xl shadow-xl py-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <p className="px-3 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                Exporteer als
              </p>
              <button
                onClick={() => {
                  onExport('csv')
                  setShowExportDropdown(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">CSV</p>
                  <p className="text-[11px] text-surface-500">Comma-separated</p>
                </div>
              </button>
              <button
                onClick={() => {
                  onExport('excel')
                  setShowExportDropdown(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">Excel</p>
                  <p className="text-[11px] text-surface-500">Met opmaak</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="p-4 bg-gradient-to-br from-surface-50 to-white border border-surface-200 rounded-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="h-4 w-4 text-surface-500" />
            <h3 className="text-sm font-semibold text-surface-700">Geavanceerde filters</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Spend Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Min. Spend
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">€</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.minSpend ?? ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      minSpend: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Max. Spend
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">€</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={filters.maxSpend ?? ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      maxSpend: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="∞"
                  className="w-full pl-7 pr-3 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
                />
              </div>
            </div>

            {/* ROAS Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
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
                className="w-full px-3 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider">
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
                className="w-full px-3 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="mt-5 pt-4 border-t border-surface-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Snelfilters</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onFiltersChange({ ...filters, minROAS: 2, maxROAS: null })}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                  'hover:shadow-md active:scale-[0.98]',
                  filters.minROAS === 2 && filters.maxROAS === null
                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                ✨ ROAS ≥ 2
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minROAS: null, maxROAS: 1 })}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                  'hover:shadow-md active:scale-[0.98]',
                  filters.minROAS === null && filters.maxROAS === 1
                    ? 'bg-red-500 text-white shadow-red-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                )}
              >
                ⚠️ ROAS {'<'} 1
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minSpend: 100, maxSpend: null })}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                  'hover:shadow-md active:scale-[0.98]',
                  filters.minSpend === 100 && filters.maxSpend === null
                    ? 'bg-blue-500 text-white shadow-blue-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                )}
              >
                💰 Spend ≥ €100
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minSpend: null, maxSpend: 10 })}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                  'hover:shadow-md active:scale-[0.98]',
                  filters.minSpend === null && filters.maxSpend === 10
                    ? 'bg-amber-500 text-white shadow-amber-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                )}
              >
                🔍 Spend {'<'} €10
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, minROAS: 3, maxROAS: null, minSpend: 50, maxSpend: null })}
                className={cn(
                  'px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                  'hover:shadow-md active:scale-[0.98]',
                  filters.minROAS === 3 && filters.minSpend === 50
                    ? 'bg-purple-500 text-white shadow-purple-200'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                )}
              >
                🚀 Top Performers
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
