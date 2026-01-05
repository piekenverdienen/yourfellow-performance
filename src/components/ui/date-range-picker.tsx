'use client'

import * as React from 'react'
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  differenceInDays,
  isSameDay,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, X, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from './calendar'

export interface DateRange {
  from: Date
  to: Date
}

export interface CompareRange {
  from: Date
  to: Date
  label: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  compareValue?: DateRange | null
  onCompareChange?: (range: DateRange | null) => void
  showCompare?: boolean
  maxDate?: Date
  minDate?: Date
  className?: string
  align?: 'start' | 'center' | 'end'
}

interface Preset {
  label: string
  shortLabel?: string
  getValue: () => DateRange
}

const presets: Preset[] = [
  {
    label: 'Vandaag',
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Gisteren',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: 'Laatste 7 dagen',
    shortLabel: '7D',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 14 dagen',
    shortLabel: '14D',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 30 dagen',
    shortLabel: '30D',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 60 dagen',
    shortLabel: '60D',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 59)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 90 dagen',
    shortLabel: '90D',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Deze week',
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorige week',
    getValue: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Deze maand',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorige maand',
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: 'Dit kwartaal',
    getValue: () => ({
      from: startOfQuarter(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorig kwartaal',
    getValue: () => ({
      from: startOfQuarter(subQuarters(new Date(), 1)),
      to: endOfQuarter(subQuarters(new Date(), 1)),
    }),
  },
  {
    label: 'Dit jaar',
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorig jaar',
    getValue: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
]

const compareOptions = [
  { label: 'Vorige periode', value: 'previous' },
  { label: 'Vorig jaar', value: 'previous_year' },
  { label: 'Aangepast', value: 'custom' },
]

function getCompareRange(range: DateRange, type: string): DateRange {
  const days = differenceInDays(range.to, range.from) + 1

  if (type === 'previous') {
    return {
      from: subDays(range.from, days),
      to: subDays(range.from, 1),
    }
  }

  if (type === 'previous_year') {
    return {
      from: subYears(range.from, 1),
      to: subYears(range.to, 1),
    }
  }

  return {
    from: subDays(range.from, days),
    to: subDays(range.from, 1),
  }
}

export function DateRangePicker({
  value,
  onChange,
  compareValue,
  onCompareChange,
  showCompare = true,
  maxDate = new Date(),
  minDate,
  className,
  align = 'end',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange>(value)
  const [compareEnabled, setCompareEnabled] = React.useState(!!compareValue)
  const [compareType, setCompareType] = React.useState<string>('previous')
  const [tempCompareRange, setTempCompareRange] = React.useState<DateRange | null>(
    compareValue || null
  )
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Find current preset
  const currentPreset = React.useMemo(() => {
    return presets.find((preset) => {
      const presetValue = preset.getValue()
      return (
        isSameDay(presetValue.from, value.from) && isSameDay(presetValue.to, value.to)
      )
    })
  }, [value])

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update temp range when value changes
  React.useEffect(() => {
    setTempRange(value)
  }, [value])

  // Update compare range when main range or type changes
  React.useEffect(() => {
    if (compareEnabled && compareType !== 'custom') {
      setTempCompareRange(getCompareRange(tempRange, compareType))
    }
  }, [tempRange, compareType, compareEnabled])

  const handlePresetClick = (preset: Preset) => {
    const newRange = preset.getValue()
    setTempRange(newRange)
  }

  const handleRangeSelect = (from: Date | null, to: Date | null) => {
    if (from && to) {
      setTempRange({ from, to })
    } else if (from) {
      setTempRange({ from, to: from })
    }
  }

  const handleApply = () => {
    onChange(tempRange)
    if (showCompare) {
      onCompareChange?.(compareEnabled ? tempCompareRange : null)
    }
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempRange(value)
    setTempCompareRange(compareValue || null)
    setCompareEnabled(!!compareValue)
    setIsOpen(false)
  }

  const formatDateRange = (range: DateRange) => {
    const days = differenceInDays(range.to, range.from) + 1
    if (days === 1) {
      return format(range.from, 'd MMM yyyy', { locale: nl })
    }
    return `${format(range.from, 'd MMM', { locale: nl })} - ${format(range.to, 'd MMM yyyy', { locale: nl })}`
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-white border border-surface-200 rounded-lg',
          'text-sm font-medium text-surface-700',
          'hover:border-surface-300 hover:bg-surface-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20',
          isOpen && 'border-[#1877F2] ring-2 ring-[#1877F2]/20'
        )}
      >
        <CalendarIcon className="h-4 w-4 text-surface-500" />
        <span className="min-w-[140px] text-left">
          {currentPreset ? currentPreset.label : formatDateRange(value)}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 bg-white rounded-xl border border-surface-200 shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0'
          )}
        >
          <div className="flex">
            {/* Presets */}
            <div className="w-48 border-r border-surface-100 p-2">
              <p className="px-2 py-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wide">
                Snelkeuze
              </p>
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {presets.map((preset) => {
                  const presetValue = preset.getValue()
                  const isActive =
                    isSameDay(presetValue.from, tempRange.from) &&
                    isSameDay(presetValue.to, tempRange.to)

                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className={cn(
                        'w-full px-2 py-1.5 text-left text-sm rounded-md transition-colors',
                        'hover:bg-surface-100',
                        isActive && 'bg-[#1877F2]/10 text-[#1877F2] font-medium'
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Calendars */}
            <div className="p-4">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wide">
                    Van
                  </p>
                  <Calendar
                    mode="range"
                    rangeStart={tempRange.from}
                    rangeEnd={tempRange.to}
                    onRangeSelect={handleRangeSelect}
                    maxDate={maxDate}
                    minDate={minDate}
                    className="border border-surface-100 rounded-lg"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wide">
                    Tot
                  </p>
                  <Calendar
                    mode="range"
                    rangeStart={tempRange.from}
                    rangeEnd={tempRange.to}
                    onRangeSelect={handleRangeSelect}
                    maxDate={maxDate}
                    minDate={minDate}
                    className="border border-surface-100 rounded-lg"
                  />
                </div>
              </div>

              {/* Selected Range Display */}
              <div className="mt-4 flex items-center gap-2 p-3 bg-surface-50 rounded-lg">
                <div className="flex-1">
                  <input
                    type="text"
                    value={format(tempRange.from, 'dd-MM-yyyy')}
                    readOnly
                    className="w-full bg-white border border-surface-200 rounded px-2 py-1 text-sm text-center"
                  />
                </div>
                <ArrowRight className="h-4 w-4 text-surface-400" />
                <div className="flex-1">
                  <input
                    type="text"
                    value={format(tempRange.to, 'dd-MM-yyyy')}
                    readOnly
                    className="w-full bg-white border border-surface-200 rounded px-2 py-1 text-sm text-center"
                  />
                </div>
              </div>

              {/* Compare Option */}
              {showCompare && (
                <div className="mt-4 pt-4 border-t border-surface-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareEnabled}
                      onChange={(e) => {
                        setCompareEnabled(e.target.checked)
                        if (e.target.checked) {
                          setTempCompareRange(getCompareRange(tempRange, compareType))
                        }
                      }}
                      className="w-4 h-4 rounded border-surface-300 text-[#1877F2] focus:ring-[#1877F2]/20"
                    />
                    <span className="text-sm font-medium text-surface-700">
                      Vergelijk met
                    </span>
                  </label>

                  {compareEnabled && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        {compareOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCompareType(option.value)}
                            className={cn(
                              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                              compareType === option.value
                                ? 'bg-[#1877F2] text-white'
                                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {tempCompareRange && (
                        <p className="text-xs text-surface-500">
                          Vergelijking:{' '}
                          <span className="font-medium text-surface-700">
                            {formatDateRange(tempCompareRange)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1877F2] hover:bg-[#1877F2]/90 rounded-lg transition-colors"
                >
                  Toepassen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export types for external use
export type { DateRangePickerProps, Preset }
