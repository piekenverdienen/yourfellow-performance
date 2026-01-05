'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import type { MetaPerformanceRow, MetaEntityType } from '@/types/meta-ads'

interface PerformanceTableProps {
  data: MetaPerformanceRow[]
  entityType: MetaEntityType
  loading?: boolean
  onSort?: (column: string, order: 'asc' | 'desc') => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface Column {
  key: keyof MetaPerformanceRow
  label: string
  format?: 'number' | 'currency' | 'percent' | 'decimal'
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
}

const columns: Column[] = [
  { key: 'entity_name', label: 'Naam', align: 'left', sortable: true },
  { key: 'spend', label: 'Spend', format: 'currency', align: 'right', sortable: true },
  { key: 'conversions', label: 'Conv.', format: 'number', align: 'right', sortable: true },
  { key: 'cost_per_conversion', label: 'CPA', format: 'currency', align: 'right', sortable: true },
  { key: 'roas', label: 'ROAS', format: 'decimal', align: 'right', sortable: true },
  { key: 'impressions', label: 'Impressies', format: 'number', align: 'right', sortable: true },
  { key: 'clicks', label: 'Clicks', format: 'number', align: 'right', sortable: true },
  { key: 'ctr', label: 'CTR', format: 'percent', align: 'right', sortable: true },
  { key: 'cpc', label: 'CPC', format: 'currency', align: 'right', sortable: true },
  { key: 'frequency', label: 'Freq.', format: 'decimal', align: 'right', sortable: true },
]

function formatValue(value: unknown, format?: Column['format']): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)
    case 'percent':
      return `${num.toFixed(2)}%`
    case 'decimal':
      return num.toFixed(2)
    case 'number':
      return new Intl.NumberFormat('nl-NL').format(num)
    default:
      return String(value)
  }
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3 w-3 text-green-500" />
    case 'down':
      return <TrendingDown className="h-3 w-3 text-red-500" />
    default:
      return <Minus className="h-3 w-3 text-surface-400" />
  }
}

export function MetaPerformanceTable({
  data,
  entityType,
  loading,
  onSort,
  sortBy,
  sortOrder,
}: PerformanceTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const handleSort = (column: Column) => {
    if (!column.sortable || !onSort) return
    const newOrder = sortBy === column.key && sortOrder === 'desc' ? 'asc' : 'desc'
    onSort(column.key, newOrder)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-200 rounded w-3/4 mx-auto" />
            <div className="h-4 bg-surface-200 rounded w-1/2 mx-auto" />
            <div className="h-4 bg-surface-200 rounded w-2/3 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="p-8 text-center text-surface-500">
          <p>Geen data gevonden voor de geselecteerde periode</p>
          <p className="text-sm mt-1">Probeer een andere datumrange of sync de data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wider',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.sortable && 'cursor-pointer hover:bg-surface-100 transition-colors'
                  )}
                  onClick={() => handleSort(column)}
                >
                  <div
                    className={cn(
                      'flex items-center gap-1',
                      column.align === 'right' && 'justify-end',
                      column.align === 'center' && 'justify-center'
                    )}
                  >
                    {column.label}
                    {column.sortable && sortBy === column.key && (
                      sortOrder === 'desc' ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold text-surface-600 uppercase tracking-wider text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {data.map((row) => (
              <tr
                key={row.entity_id}
                className={cn(
                  'transition-colors',
                  hoveredRow === row.entity_id && 'bg-surface-50',
                  row.has_fatigue_warning && 'bg-amber-50/50'
                )}
                onMouseEnter={() => setHoveredRow(row.entity_id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-sm',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.key === 'entity_name' && 'font-medium text-surface-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {column.key === 'entity_name' && row.has_fatigue_warning && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                      <span className={cn(
                        column.key !== 'entity_name' && 'text-surface-700'
                      )}>
                        {formatValue(row[column.key], column.format)}
                      </span>
                      {column.key === 'ctr' && (
                        <TrendIndicator trend={row.ctr_trend} />
                      )}
                      {column.key === 'roas' && (
                        <TrendIndicator trend={row.roas_trend} />
                      )}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  {row.has_fatigue_warning ? (
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      row.fatigue_severity === 'critical' && 'bg-red-100 text-red-700',
                      row.fatigue_severity === 'high' && 'bg-orange-100 text-orange-700',
                      row.fatigue_severity === 'medium' && 'bg-amber-100 text-amber-700',
                      row.fatigue_severity === 'low' && 'bg-yellow-100 text-yellow-700'
                    )}>
                      Fatigue: {row.fatigue_severity}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Healthy
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
