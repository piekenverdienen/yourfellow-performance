'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Plus,
  ChevronRight,
  Rocket,
  ShoppingCart,
  Flag,
  Clock,
  Heart,
  Globe,
  Loader2,
} from 'lucide-react'
import { format, isToday, isTomorrow, addDays, startOfWeek, endOfWeek } from 'date-fns'
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

function formatDayLabel(date: Date): string {
  if (isToday(date)) return 'Vandaag'
  if (isTomorrow(date)) return 'Morgen'
  return format(date, 'EEEE d MMMM', { locale: nl })
}

export function WeekOverview({ onAddEvent, selectedClientId }: WeekOverviewProps) {
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const params = new URLSearchParams({ mode: 'week' })
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
  }, [selectedClientId])

  // Group events by date
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = event.event_date
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(event)
    return acc
  }, {} as Record<string, MarketingEvent[]>)

  // Generate array of days this week
  const weekDays: Date[] = []
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i))
  }

  // Filter to only days with events
  const daysWithEvents = weekDays.filter(day => {
    const dateKey = format(day, 'yyyy-MM-dd')
    return eventsByDate[dateKey]?.length > 0
  })

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-surface-900">Deze Week</h3>
            {events.length > 0 && (
              <Badge variant="secondary" className="ml-1">{events.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onAddEvent && (
              <Button variant="ghost" size="sm" onClick={onAddEvent}>
                <Plus className="h-4 w-4 mr-1" />
                Event
              </Button>
            )}
            <Link href="/calendar">
              <Button variant="ghost" size="sm">
                Kalender
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {daysWithEvents.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-10 w-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-600 text-sm">
              Geen events gepland deze week
            </p>
            {onAddEvent && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onAddEvent}>
                <Plus className="h-4 w-4 mr-1" />
                Eerste event toevoegen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {daysWithEvents.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate[dateKey] || []

              return (
                <div key={dateKey}>
                  <p className={cn(
                    'text-sm font-medium mb-2',
                    isToday(day) ? 'text-primary' : 'text-surface-600'
                  )}>
                    {formatDayLabel(day)}
                  </p>
                  <div className="space-y-2 pl-2 border-l-2 border-surface-100">
                    {dayEvents.map((event) => {
                      const config = eventTypeConfig[event.event_type]
                      const Icon = config?.icon || Calendar

                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface-50 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${event.color}20` }}
                          >
                            <Icon
                              className="h-4 w-4"
                              style={{ color: event.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-surface-900 text-sm">
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {event.is_global && (
                                <span className="flex items-center gap-1 text-xs text-surface-500">
                                  <Globe className="h-3 w-3" />
                                  Globaal
                                </span>
                              )}
                              {event.client && (
                                <span className="text-xs text-surface-500">
                                  {event.client.name}
                                </span>
                              )}
                              {!event.client && !event.is_global && (
                                <span className="text-xs text-surface-500">
                                  Persoonlijk
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
