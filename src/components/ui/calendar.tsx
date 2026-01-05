'use client'

import * as React from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarProps {
  selected?: Date | null
  onSelect?: (date: Date) => void
  rangeStart?: Date | null
  rangeEnd?: Date | null
  onRangeSelect?: (start: Date | null, end: Date | null) => void
  mode?: 'single' | 'range'
  disabled?: (date: Date) => boolean
  minDate?: Date
  maxDate?: Date
  defaultMonth?: Date
  className?: string
}

export function Calendar({
  selected,
  onSelect,
  rangeStart,
  rangeEnd,
  onRangeSelect,
  mode = 'single',
  disabled,
  minDate,
  maxDate,
  defaultMonth,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    defaultMonth || rangeStart || selected || new Date()
  )
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)
  const [selectingStart, setSelectingStart] = React.useState(true)

  // Update month when defaultMonth changes
  React.useEffect(() => {
    if (defaultMonth) {
      setCurrentMonth(defaultMonth)
    }
  }, [defaultMonth])

  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const days: Date[] = []
    let day = start

    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }

    return days
  }

  const isDateDisabled = (date: Date) => {
    if (disabled && disabled(date)) return true
    if (minDate && isBefore(date, startOfMonth(minDate))) return true
    if (maxDate && isAfter(date, maxDate)) return true
    return false
  }

  const isInRange = (date: Date) => {
    if (mode !== 'range') return false
    if (!rangeStart) return false

    const effectiveEnd = rangeEnd || hoverDate

    if (!effectiveEnd) return false

    const start = isBefore(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd
    const end = isBefore(rangeStart, effectiveEnd) ? effectiveEnd : rangeStart

    return isWithinInterval(date, { start, end })
  }

  const isRangeStart = (date: Date) => {
    if (mode !== 'range' || !rangeStart) return false
    return isSameDay(date, rangeStart)
  }

  const isRangeEnd = (date: Date) => {
    if (mode !== 'range') return false
    const effectiveEnd = rangeEnd || hoverDate
    if (!effectiveEnd) return false
    return isSameDay(date, effectiveEnd)
  }

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return

    if (mode === 'single') {
      onSelect?.(date)
    } else {
      if (selectingStart || !rangeStart) {
        onRangeSelect?.(date, null)
        setSelectingStart(false)
      } else {
        if (isBefore(date, rangeStart)) {
          onRangeSelect?.(date, rangeStart)
        } else {
          onRangeSelect?.(rangeStart, date)
        }
        setSelectingStart(true)
      }
    }
  }

  const days = getDaysInMonth()

  // Check if we can navigate to previous/next month
  const canGoPrev = !minDate || !isBefore(subMonths(currentMonth, 1), startOfMonth(minDate))
  const canGoNext = !maxDate || !isAfter(addMonths(currentMonth, 1), startOfMonth(addMonths(maxDate, 1)))

  return (
    <div className={cn('p-3 bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => canGoPrev && setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={!canGoPrev}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            canGoPrev
              ? 'hover:bg-surface-100 text-surface-600 hover:text-surface-900'
              : 'text-surface-300 cursor-not-allowed'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-surface-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button
          type="button"
          onClick={() => canGoNext && setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={!canGoNext}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            canGoNext
              ? 'hover:bg-surface-100 text-surface-600 hover:text-surface-900'
              : 'text-surface-300 cursor-not-allowed'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-surface-400 uppercase tracking-wider py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected =
            mode === 'single' && selected && isSameDay(day, selected)
          const isDisabled = isDateDisabled(day)
          const inRange = isInRange(day)
          const isStart = isRangeStart(day)
          const isEnd = isRangeEnd(day)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDateClick(day)}
              onMouseEnter={() => mode === 'range' && setHoverDate(day)}
              onMouseLeave={() => mode === 'range' && setHoverDate(null)}
              disabled={isDisabled || !isCurrentMonth}
              className={cn(
                'relative h-9 w-9 text-sm transition-all duration-100',
                'focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:z-10',
                // Base states
                !isCurrentMonth && 'text-surface-200 cursor-default',
                isCurrentMonth && !isDisabled && 'text-surface-700 hover:bg-surface-100 cursor-pointer',
                isCurrentMonth && !isDisabled && 'rounded-lg',
                // Today
                isToday && isCurrentMonth && 'font-bold text-[#1877F2]',
                // Disabled
                isDisabled && isCurrentMonth && 'text-surface-300 cursor-not-allowed hover:bg-transparent',
                // Single selection
                isSelected && 'bg-[#1877F2] text-white hover:bg-[#1877F2]/90 rounded-lg font-semibold',
                // Range - in range but not start/end
                inRange && !isStart && !isEnd && isCurrentMonth && 'bg-[#1877F2]/10 rounded-none',
                // Range start
                isStart && isCurrentMonth && 'bg-[#1877F2] text-white font-semibold rounded-l-lg rounded-r-none',
                // Range end
                isEnd && isCurrentMonth && 'bg-[#1877F2] text-white font-semibold rounded-r-lg rounded-l-none',
                // Both start and end (single day range)
                isStart && isEnd && isCurrentMonth && 'rounded-lg',
                // Start without end yet
                isStart && !rangeEnd && isCurrentMonth && 'rounded-lg'
              )}
            >
              <span className="relative z-10">{format(day, 'd')}</span>
              {isToday && !isSelected && !isStart && !isEnd && isCurrentMonth && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1877F2] rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
