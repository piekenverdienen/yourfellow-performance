'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Rocket,
  ShoppingCart,
  Flag,
  Clock,
  Heart,
  Calendar,
  Gift,
  Loader2,
} from 'lucide-react'
import {
  format,
  isToday,
  isTomorrow,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  getWeek,
  differenceInDays,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MarketingEvent, EventType } from '@/types'
import Link from 'next/link'

interface WeekOverviewProps {
  onAddEvent?: () => void
  selectedClientId?: string | null
}

const eventIcons: Record<EventType, React.ElementType> = {
  launch: Rocket,
  sale: ShoppingCart,
  campaign: Flag,
  deadline: Clock,
  life: Heart,
  holiday: Gift,
}

const eventLabels: Record<EventType, string> = {
  launch: 'Lancering',
  sale: 'Sale',
  campaign: 'Campagne',
  deadline: 'Deadline',
  life: 'Persoonlijk',
  holiday: 'Feestdag',
}

export function WeekOverview({ onAddEvent, selectedClientId }: WeekOverviewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [currentMonth, selectedClientId])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      let url = `/api/calendar/events?year=${year}&month=${month}`
      if (selectedClientId) {
        url += `&clientId=${selectedClientId}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getEventsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.event_date === dateStr)
  }

  // Find next upcoming event for context message
  const getContextMessage = () => {
    const today = new Date()
    const sortedEvents = [...events]
      .filter(e => new Date(e.event_date) >= today)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())

    if (sortedEvents.length === 0) return null

    const nextEvent = sortedEvents[0]
    const eventDate = new Date(nextEvent.event_date)
    const daysUntil = differenceInDays(eventDate, today)

    let prefix = ''
    if (isToday(eventDate)) {
      prefix = 'Vandaag is het'
    } else if (isTomorrow(eventDate)) {
      prefix = 'Morgen is het'
    } else if (daysUntil <= 7) {
      prefix = `${format(eventDate, 'EEEE', { locale: nl })} is het`
    } else {
      prefix = `${format(eventDate, 'd MMMM', { locale: nl })} is het`
    }

    return { prefix, title: nextEvent.title, color: nextEvent.color }
  }

  // Get events for this month to show in sidebar
  const upcomingEvents = events
    .filter(e => new Date(e.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 5)

  const contextMessage = getContextMessage()
  const weekNumber = getWeek(currentMonth, { weekStartsOn: 1 })

  return (
    <Card className="overflow-hidden">
      {/* Header with month navigation and context message */}
      <div className="p-4 border-b border-surface-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 hover:bg-surface-100 rounded transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-surface-500" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 hover:bg-surface-100 rounded transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </button>
            <span className="font-semibold text-surface-900">
              {format(currentMonth, 'MMMM yyyy', { locale: nl })}
            </span>
          </div>
          <span className="text-sm text-surface-500">Week {weekNumber}</span>
        </div>

        {/* Context message */}
        {contextMessage && (
          <div className="text-sm">
            <span className="text-surface-600">{contextMessage.prefix} </span>
            <span className="font-semibold" style={{ color: contextMessage.color }}>
              {contextMessage.title}!
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Mini Calendar */}
          <div className="p-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-surface-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((date, idx) => {
                const dayEvents = getEventsForDay(date)
                const isCurrentMonth = isSameMonth(date, currentMonth)
                const isCurrentDay = isToday(date)

                return (
                  <div
                    key={idx}
                    className={cn(
                      'relative aspect-square flex flex-col items-center justify-center text-sm rounded',
                      isCurrentMonth ? 'text-surface-900' : 'text-surface-300',
                      isCurrentDay && 'bg-primary text-black font-bold'
                    )}
                  >
                    <span>{format(date, 'd')}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: e.color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="border-t border-surface-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-surface-900 text-sm">Marketingevents</h3>
              <Button variant="ghost" size="sm" onClick={onAddEvent} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Toevoegen
              </Button>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-4">
                Geen events gepland
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => {
                  const Icon = eventIcons[event.event_type] || Calendar
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <div
                        className="w-1 h-full min-h-[2.5rem] rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-surface-500">
                          {format(new Date(event.event_date), 'd MMMM', { locale: nl })}
                          {event.client && (
                            <span className="ml-1">• {event.client.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Link href="/kalender" className="block mt-4">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Bekijk volledige kalender
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </Card>
  )
}
