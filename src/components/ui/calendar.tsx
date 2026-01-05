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
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    rangeStart || selected || new Date()
  )
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)
  const [selectingStart, setSelectingStart] = React.useState(true)

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
    if (minDate && isBefore(date, minDate)) return true
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

  return (
    <div className={cn('p-3 bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-surface-100 rounded-md transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-surface-600" />
        </button>
        <span className="text-sm font-semibold text-surface-900">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-surface-100 rounded-md transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-surface-600" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-surface-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
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
              disabled={isDisabled}
              className={cn(
                'relative h-8 w-8 text-sm rounded-md transition-all',
                'hover:bg-surface-100 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20',
                !isCurrentMonth && 'text-surface-300',
                isCurrentMonth && 'text-surface-700',
                isToday && 'font-bold',
                isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent',
                isSelected && 'bg-[#1877F2] text-white hover:bg-[#1877F2]/90',
                inRange && !isStart && !isEnd && 'bg-[#1877F2]/10',
                (isStart || isEnd) && 'bg-[#1877F2] text-white hover:bg-[#1877F2]/90',
                isStart && rangeEnd && 'rounded-r-none',
                isEnd && rangeStart && 'rounded-l-none',
                inRange && !isStart && !isEnd && 'rounded-none'
              )}
            >
              {format(day, 'd')}
              {isToday && !isSelected && !isStart && !isEnd && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1877F2] rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
