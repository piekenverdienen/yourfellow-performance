'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { AddEventDialog } from '@/components/calendar'
import { useUser } from '@/hooks/use-user'
import { useClientStore } from '@/stores/client-store'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Rocket,
  ShoppingCart,
  Flag,
  Clock,
  Heart,
  Globe,
  Trash2,
  Building2,
} from 'lucide-react'
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
  isToday,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MarketingEvent, EventType } from '@/types'

const eventTypeConfig: Record<EventType, { icon: typeof Rocket; label: string }> = {
  launch: { icon: Rocket, label: 'Launch' },
  sale: { icon: ShoppingCart, label: 'Sale' },
  campaign: { icon: Flag, label: 'Campagne' },
  deadline: { icon: Clock, label: 'Deadline' },
  life: { icon: Heart, label: 'Life Event' },
  holiday: { icon: Calendar, label: 'Feestdag' },
}

export default function CalendarPage() {
  const { user } = useUser()
  const { clients, selectedClient } = useClientStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filterClientId, setFilterClientId] = useState<string>('')
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  // Fetch events for current month
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          year: currentDate.getFullYear().toString(),
          month: (currentDate.getMonth() + 1).toString(),
          mode: 'month',
        })

        if (filterClientId) {
          params.append('client_id', filterClientId)
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
  }, [currentDate, filterClientId])

  const handleEventAdded = () => {
    // Re-fetch events
    const params = new URLSearchParams({
      year: currentDate.getFullYear().toString(),
      month: (currentDate.getMonth() + 1).toString(),
      mode: 'month',
    })
    if (filterClientId) {
      params.append('client_id', filterClientId)
    }
    fetch(`/api/calendar/events?${params}`)
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Weet je zeker dat je dit event wilt verwijderen?')) return

    setDeletingEventId(eventId)
    try {
      const res = await fetch(`/api/calendar/events?id=${eventId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setEvents(events.filter(e => e.id !== eventId))
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    } finally {
      setDeletingEventId(null)
    }
  }

  // Calendar grid generation
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    calendarDays.push(day)
    day = addDays(day, 1)
  }

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return events.filter(e => e.event_date === dateStr)
  }

  // Events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Kalender</h1>
          <p className="text-surface-600 mt-1">
            Bekijk en beheer belangrijke datums en events
          </p>
        </div>
        <Button onClick={() => {
          setSelectedDate(new Date())
          setShowAddEvent(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuw Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-xl font-semibold text-surface-900 min-w-[200px] text-center">
                    {format(currentDate, 'MMMM yyyy', { locale: nl })}
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Select
                    value={filterClientId}
                    onChange={(e) => setFilterClientId(e.target.value)}
                    options={[
                      { value: '', label: 'Alle clients' },
                      ...clients.map(c => ({ value: c.id, label: c.name })),
                    ]}
                    className="w-[180px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Vandaag
                  </Button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-surface-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-surface-400" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, idx) => {
                    const dayEvents = getEventsForDay(date)
                    const isCurrentMonth = isSameMonth(date, currentDate)
                    const isSelected = selectedDate && isSameDay(date, selectedDate)

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          'min-h-[100px] p-2 rounded-lg text-left transition-all',
                          'hover:bg-surface-50 border border-transparent',
                          !isCurrentMonth && 'opacity-40',
                          isToday(date) && 'bg-primary/5 border-primary/20',
                          isSelected && 'ring-2 ring-primary bg-primary/5'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm',
                            isToday(date)
                              ? 'bg-primary text-black font-bold'
                              : 'text-surface-700'
                          )}
                        >
                          {format(date, 'd')}
                        </span>

                        {/* Event dots */}
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center gap-1 text-xs truncate"
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: event.color }}
                              />
                              <span className="truncate text-surface-700">
                                {event.title}
                              </span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-xs text-surface-500">
                              +{dayEvents.length - 3} meer
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Selected Day Details */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              {selectedDate ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-surface-500">
                        {format(selectedDate, 'EEEE', { locale: nl })}
                      </p>
                      <h3 className="text-xl font-semibold text-surface-900">
                        {format(selectedDate, 'd MMMM yyyy', { locale: nl })}
                      </h3>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowAddEvent(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-10 w-10 text-surface-300 mx-auto mb-3" />
                      <p className="text-surface-600 text-sm">
                        Geen events op deze dag
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowAddEvent(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Event toevoegen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateEvents.map((event) => {
                        const config = eventTypeConfig[event.event_type]
                        const Icon = config?.icon || Calendar
                        const canDelete = event.created_by === user?.id || isAdmin

                        return (
                          <div
                            key={event.id}
                            className="p-4 rounded-xl bg-surface-50 border border-surface-100"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${event.color}20` }}
                              >
                                <Icon
                                  className="h-5 w-5"
                                  style={{ color: event.color }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-surface-900">
                                  {event.title}
                                </h4>
                                {event.description && (
                                  <p className="text-sm text-surface-600 mt-1">
                                    {event.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {config?.label || event.event_type}
                                  </Badge>
                                  {event.is_global && (
                                    <span className="flex items-center gap-1 text-xs text-surface-500">
                                      <Globe className="h-3 w-3" />
                                      Globaal
                                    </span>
                                  )}
                                  {event.client && (
                                    <span className="flex items-center gap-1 text-xs text-surface-500">
                                      <Building2 className="h-3 w-3" />
                                      {event.client.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  disabled={deletingEventId === event.id}
                                  className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  {deletingEventId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 text-surface-300 mx-auto mb-3" />
                  <p className="text-surface-600 text-sm">
                    Selecteer een dag om details te bekijken
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <h4 className="font-medium text-surface-900 mb-3 text-sm">Event Types</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(eventTypeConfig).map(([type, config]) => {
                  const Icon = config.icon
                  const color = {
                    launch: '#00FFCC',
                    sale: '#EF4444',
                    campaign: '#3B82F6',
                    deadline: '#F97316',
                    life: '#8B5CF6',
                    holiday: '#22C55E',
                  }[type]

                  return (
                    <div key={type} className="flex items-center gap-2 text-xs">
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                      <span className="text-surface-600">{config.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <AddEventDialog
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        onEventAdded={handleEventAdded}
        clients={clients}
        selectedClientId={selectedClient?.id}
        isAdmin={isAdmin}
        defaultDate={selectedDate || undefined}
      />
    </div>
  )
}
