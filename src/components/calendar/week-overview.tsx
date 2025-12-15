'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Plus,
  ChevronRight,
  ChevronLeft,
  Rocket,
  ShoppingCart,
  Flag,
  Clock,
  Heart,
} from 'lucide-react'
import {
  format,
  isToday,
  addDays,
  addMonths,
  subMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  getWeek,
  differenceInDays,
  parseISO,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MarketingEvent, EventType } from '@/types'
import Link from 'next/link'

interface WeekOverviewProps {
  onAddEvent?: () => void
  selectedClientId?: string | null
}

const eventTypeConfig: Record<EventType, { icon: typeof Rocket; label: string }> = {
  launch: { icon: Rocket, label: 'Launch' },
  sale: { icon: ShoppingCart, label: 'Sale' },
  campaign: { icon: Flag, label: 'Campagne' },
  deadline: { icon: Clock, label: 'Deadline' },
  life: { icon: Heart, label: 'Life Event' },
  holiday: { icon: Calendar, label: 'Feestdag' },
}

function getContextMessage(events: MarketingEvent[]): { prefix: string; event: MarketingEvent } | null {
  if (events.length === 0) return null

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) =>
    a.event_date.localeCompare(b.event_date)
  )

  // Check for today's event first
  const todayEvent = sortedEvents.find(e => e.event_date === todayStr)
  if (todayEvent) {
    return { prefix: 'Vandaag is het', event: todayEvent }
  }

  // Find next upcoming event
  const upcomingEvent = sortedEvents.find(e => e.event_date > todayStr)
  if (upcomingEvent) {
    const eventDate = parseISO(upcomingEvent.event_date)
    const daysUntil = differenceInDays(eventDate, today)

    let prefix: string
    if (daysUntil === 1) {
      prefix = 'Morgen is het'
    } else if (daysUntil < 7) {
      prefix = `${format(eventDate, 'EEEE', { locale: nl })} is het`
    } else {
      prefix = `${format(eventDate, 'd MMMM', { locale: nl })} is het`
    }

    return { prefix, event: upcomingEvent }
  }

  return null
}

export function WeekOverview({ onAddEvent, selectedClientId }: WeekOverviewProps) {
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    async function fetchEvents() {
      try {
        // Fetch current month events for mini calendar
        const params = new URLSearchParams({
          year: currentMonth.getFullYear().toString(),
          month: (currentMonth.getMonth() + 1).toString(),
          mode: 'month',
        })
        if (selectedClientId) {
          params.append('client_id', selectedClientId)
        }

        const res = await fetch(`/api/calendar/events?${params}`)
        const data = await res.json()
        setEvents(data.events || [])
      } catch (error) {
        console.error('Failed to fetch events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [selectedClientId, currentMonth])

  // Mini calendar generation
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })

  const calendarDays: Date[] = []
  let day = calendarStart
  // Generate 6 weeks of days
  for (let i = 0; i < 42; i++) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  // Get events for a specific day
  const getEventsForDay = (date: Date): MarketingEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.event_date === dateStr)
  }

  // Get upcoming events for sidebar (next 30 days)
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const upcomingEvents = events
    .filter(e => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 5)

  // Context message
  const contextMessage = getContextMessage(events)
  const weekNumber = getWeek(currentMonth, { weekStartsOn: 1, firstWeekContainsDate: 4 })

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-surface-50 to-surface-100/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-surface-50 to-surface-100/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Header with navigation */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-surface-900">
              {format(currentMonth, 'MMMM yyyy', { locale: nl })}
            </h3>
          </div>
          <span className="text-sm text-surface-500">Week {weekNumber}</span>
        </div>

        {/* Context message */}
        {contextMessage && (
          <div className="px-5 pb-4">
            <p className="text-sm text-surface-600">
              {contextMessage.prefix}{' '}
              <span className="font-semibold text-surface-900">
                {contextMessage.event.title}
              </span>
              {contextMessage.event.description && (
                <span className="text-surface-500">
                  . {contextMessage.event.description}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Mini Calendar */}
        <div className="px-5 pb-4">
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
            {calendarDays.slice(0, 35).map((date, idx) => {
              const dayEvents = getEventsForDay(date)
              const isCurrentMonth = isSameMonth(date, currentMonth)
              const isCurrentDay = isToday(date)

              // Get unique event colors for dots
              const eventColors = dayEvents.slice(0, 3).map(e => e.color)

              return (
                <div
                  key={idx}
                  className={cn(
                    'relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm',
                    !isCurrentMonth && 'text-surface-300',
                    isCurrentMonth && 'text-surface-700',
                    isCurrentDay && 'bg-primary text-black font-bold'
                  )}
                >
                  <span>{format(date, 'd')}</span>
                  {/* Event dots */}
                  {eventColors.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {eventColors.map((color, i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: isCurrentDay ? '#000' : color }}
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
        <div className="bg-white/50 px-5 py-4 border-t border-surface-200/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-surface-700 text-sm">Marketingevents</h4>
            {onAddEvent && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddEvent}>
                <Plus className="h-3 w-3 mr-1" />
                Toevoegen
              </Button>
            )}
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-surface-500 py-4 text-center">
              Geen events deze maand
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const eventDate = parseISO(event.event_date)

                return (
                  <Link
                    key={event.id}
                    href="/calendar"
                    className="block group"
                  >
                    <div
                      className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-100/50 transition-colors"
                    >
                      <div
                        className="w-1 h-full min-h-[36px] rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-sm group-hover:text-primary transition-colors truncate"
                          style={{ color: event.color }}
                        >
                          {event.title}
                        </p>
                        <p className="text-xs text-surface-500">
                          {format(eventDate, 'd MMMM', { locale: nl })}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* View all link */}
          <Link href="/calendar" className="block mt-3">
            <Button variant="ghost" size="sm" className="w-full text-xs text-surface-600">
              Bekijk volledige kalender
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
