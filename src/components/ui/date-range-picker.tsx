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
  addMonths,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, ArrowRight, Clock, Sparkles } from 'lucide-react'
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
  category: 'quick' | 'week' | 'month' | 'quarter' | 'year'
}

const presets: Preset[] = [
  {
    label: 'Vandaag',
    category: 'quick',
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Gisteren',
    category: 'quick',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: 'Laatste 7 dagen',
    shortLabel: '7D',
    category: 'quick',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 14 dagen',
    shortLabel: '14D',
    category: 'quick',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 30 dagen',
    shortLabel: '30D',
    category: 'quick',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 60 dagen',
    shortLabel: '60D',
    category: 'month',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 59)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Laatste 90 dagen',
    shortLabel: '90D',
    category: 'quarter',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Deze week',
    category: 'week',
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorige week',
    category: 'week',
    getValue: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Deze maand',
    category: 'month',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorige maand',
    category: 'month',
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: 'Dit kwartaal',
    category: 'quarter',
    getValue: () => ({
      from: startOfQuarter(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorig kwartaal',
    category: 'quarter',
    getValue: () => ({
      from: startOfQuarter(subQuarters(new Date(), 1)),
      to: endOfQuarter(subQuarters(new Date(), 1)),
    }),
  },
  {
    label: 'Dit jaar',
    category: 'year',
    getValue: () => ({
      from: startOfYear(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Vorig jaar',
    category: 'year',
    getValue: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
]

const compareOptions = [
  { label: 'Vorige periode', value: 'previous', icon: '↩️' },
  { label: 'Vorig jaar', value: 'previous_year', icon: '📅' },
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
  const [leftMonth, setLeftMonth] = React.useState(subMonths(new Date(), 1))
  const [rightMonth, setRightMonth] = React.useState(new Date())
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

  // Calculate days in range
  const daysInRange = React.useMemo(() => {
    return differenceInDays(tempRange.to, tempRange.from) + 1
  }, [tempRange])

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

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

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
    // Auto-adjust calendar months to show the selected range
    setLeftMonth(startOfMonth(newRange.from))
    setRightMonth(startOfMonth(newRange.to))
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

  // Group presets by category
  const presetsByCategory = React.useMemo(() => {
    return {
      quick: presets.filter(p => p.category === 'quick'),
      week: presets.filter(p => p.category === 'week'),
      month: presets.filter(p => p.category === 'month'),
      quarter: presets.filter(p => p.category === 'quarter'),
      year: presets.filter(p => p.category === 'year'),
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex items-center gap-2.5 px-4 py-2.5 bg-white border border-surface-200 rounded-xl',
          'text-sm font-medium text-surface-700',
          'hover:border-[#1877F2]/30 hover:bg-gradient-to-r hover:from-[#1877F2]/5 hover:to-transparent',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]',
          isOpen && 'border-[#1877F2] ring-2 ring-[#1877F2]/20 bg-gradient-to-r from-[#1877F2]/5 to-transparent'
        )}
      >
        <CalendarIcon className={cn(
          'h-4 w-4 transition-colors',
          isOpen ? 'text-[#1877F2]' : 'text-surface-400 group-hover:text-[#1877F2]'
        )} />
        <div className="flex flex-col items-start">
          <span className="font-semibold">
            {currentPreset ? currentPreset.label : formatDateRange(value)}
          </span>
          {!currentPreset && (
            <span className="text-[10px] text-surface-400 font-normal">
              {differenceInDays(value.to, value.from) + 1} dagen
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-400 transition-transform duration-200',
            isOpen && 'rotate-180 text-[#1877F2]'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 bg-white rounded-2xl border border-surface-200 shadow-2xl',
            'animate-in fade-in-0 slide-in-from-top-2 duration-200',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0'
          )}
          style={{ minWidth: '720px' }}
        >
          <div className="flex">
            {/* Presets Sidebar */}
            <div className="w-52 border-r border-surface-100 p-3 bg-surface-50/50 rounded-l-2xl">
              {/* Quick Access */}
              <div className="mb-3">
                <p className="px-2 py-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Snel
                </p>
                <div className="space-y-0.5 mt-1">
                  {presetsByCategory.quick.map((preset) => {
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
                          'w-full px-3 py-2 text-left text-sm rounded-lg transition-all duration-150',
                          'hover:bg-white hover:shadow-sm',
                          isActive && 'bg-[#1877F2] text-white shadow-md hover:bg-[#1877F2] hover:shadow-md'
                        )}
                      >
                        <span className="font-medium">{preset.label}</span>
                        {preset.shortLabel && !isActive && (
                          <span className="ml-2 text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                            {preset.shortLabel}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Week */}
              <div className="mb-3">
                <p className="px-2 py-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                  Week
                </p>
                <div className="space-y-0.5 mt-1">
                  {presetsByCategory.week.map((preset) => {
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
                          'w-full px-3 py-2 text-left text-sm rounded-lg transition-all duration-150',
                          'hover:bg-white hover:shadow-sm',
                          isActive && 'bg-[#1877F2] text-white shadow-md hover:bg-[#1877F2]'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Month */}
              <div className="mb-3">
                <p className="px-2 py-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                  Maand
                </p>
                <div className="space-y-0.5 mt-1">
                  {presetsByCategory.month.map((preset) => {
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
                          'w-full px-3 py-2 text-left text-sm rounded-lg transition-all duration-150',
                          'hover:bg-white hover:shadow-sm',
                          isActive && 'bg-[#1877F2] text-white shadow-md hover:bg-[#1877F2]'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quarter & Year */}
              <div>
                <p className="px-2 py-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                  Kwartaal & Jaar
                </p>
                <div className="space-y-0.5 mt-1">
                  {[...presetsByCategory.quarter, ...presetsByCategory.year].map((preset) => {
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
                          'w-full px-3 py-2 text-left text-sm rounded-lg transition-all duration-150',
                          'hover:bg-white hover:shadow-sm',
                          isActive && 'bg-[#1877F2] text-white shadow-md hover:bg-[#1877F2]'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4">
              {/* Selected Range Summary */}
              <div className="mb-4 p-3 bg-gradient-to-r from-[#1877F2]/10 to-[#1877F2]/5 rounded-xl border border-[#1877F2]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-white rounded-lg border border-surface-200 shadow-sm">
                        <span className="text-sm font-semibold text-surface-900">
                          {format(tempRange.from, 'd MMM yyyy', { locale: nl })}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#1877F2]" />
                      <div className="px-3 py-1.5 bg-white rounded-lg border border-surface-200 shadow-sm">
                        <span className="text-sm font-semibold text-surface-900">
                          {format(tempRange.to, 'd MMM yyyy', { locale: nl })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] text-white rounded-lg">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold">{daysInRange}</span>
                    <span className="text-xs opacity-80">dagen</span>
                  </div>
                </div>
              </div>

              {/* Calendars */}
              <div className="flex gap-3">
                <Calendar
                  mode="range"
                  rangeStart={tempRange.from}
                  rangeEnd={tempRange.to}
                  onRangeSelect={handleRangeSelect}
                  maxDate={maxDate}
                  minDate={minDate}
                  defaultMonth={leftMonth}
                  className="border border-surface-100 rounded-xl shadow-sm"
                />
                <Calendar
                  mode="range"
                  rangeStart={tempRange.from}
                  rangeEnd={tempRange.to}
                  onRangeSelect={handleRangeSelect}
                  maxDate={maxDate}
                  minDate={minDate}
                  defaultMonth={rightMonth}
                  className="border border-surface-100 rounded-xl shadow-sm"
                />
              </div>

              {/* Compare Option */}
              {showCompare && (
                <div className="mt-4 p-3 bg-surface-50 rounded-xl border border-surface-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={compareEnabled}
                        onChange={(e) => {
                          setCompareEnabled(e.target.checked)
                          if (e.target.checked) {
                            setTempCompareRange(getCompareRange(tempRange, compareType))
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-surface-200 rounded-full peer-checked:bg-[#1877F2] transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">
                      Vergelijk met vorige periode
                    </span>
                  </label>

                  {compareEnabled && (
                    <div className="mt-3 pl-13 space-y-3">
                      <div className="flex gap-2">
                        {compareOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCompareType(option.value)}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                              compareType === option.value
                                ? 'bg-[#1877F2] text-white shadow-md'
                                : 'bg-white text-surface-600 border border-surface-200 hover:border-[#1877F2]/30'
                            )}
                          >
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>

                      {tempCompareRange && (
                        <div className="flex items-center gap-2 text-sm text-surface-500">
                          <span>Vergelijken met:</span>
                          <span className="font-semibold text-surface-700 bg-surface-100 px-2 py-0.5 rounded">
                            {formatDateRange(tempCompareRange)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-surface-400">
                  Druk op <kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-[10px] font-mono">Esc</kbd> om te annuleren
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1877F2] hover:bg-[#1565c0] rounded-lg transition-colors shadow-md hover:shadow-lg"
                  >
                    Toepassen
                  </button>
                </div>
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
