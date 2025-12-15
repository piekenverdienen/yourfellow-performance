'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/use-user'
import { useClientStore } from '@/stores/client-store'
import { AddEventDialog } from '@/components/calendar'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Rocket,
  ShoppingCart,
  Flag,
  Clock,
  Heart,
  Gift,
  Calendar,
  Loader2,
  Trash2,
  Globe,
  Building2,
  User,
} from 'lucide-react'
import {
  format,
  isToday,
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
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MarketingEvent, EventType, ClientWithRole } from '@/types'

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

export default function KalenderPage() {
  const { user, loading: userLoading } = useUser()
  const { clients, selectedClient, isLoading: clientsLoading, fetchClients } = useClientStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    fetchEvents()
  }, [currentMonth, selectedClient])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      let url = `/api/calendar/events?year=${year}&month=${month}`
      if (selectedClient) {
        url += `&clientId=${selectedClient.id}`
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

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Weet je zeker dat je dit event wilt verwijderen?')) return

    setDeletingId(eventId)
    try {
      const res = await fetch(`/api/calendar/events?id=${eventId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchEvents()
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    } finally {
      setDeletingId(null)
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

  // Group events by date for sidebar
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : []

  if (userLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Marketing Kalender</h1>
          <p className="text-surface-600">
            {selectedClient
              ? `Events voor ${selectedClient.name}`
              : 'Alle marketing events en belangrijke datums'}
          </p>
        </div>
        <Button onClick={() => setShowAddEvent(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Event Toevoegen
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 text-surface-600" />
                  </button>
                  <h2 className="text-xl font-semibold text-surface-900 min-w-[180px] text-center">
                    {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                  </h2>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-surface-600" />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Vandaag
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'].map((d) => (
                      <div key={d} className="text-center text-sm font-medium text-surface-500 py-2">
                        {d.slice(0, 2)}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((date, idx) => {
                      const dayEvents = getEventsForDay(date)
                      const isCurrentMonth = isSameMonth(date, currentMonth)
                      const isCurrentDay = isToday(date)
                      const isSelected = selectedDate && isSameDay(date, selectedDate)

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            'min-h-[80px] p-2 rounded-lg text-left transition-all',
                            isCurrentMonth ? 'bg-white' : 'bg-surface-50',
                            isCurrentDay && 'ring-2 ring-primary',
                            isSelected && 'bg-primary/10',
                            'hover:bg-surface-100'
                          )}
                        >
                          <span className={cn(
                            'text-sm font-medium',
                            isCurrentMonth ? 'text-surface-900' : 'text-surface-400',
                            isCurrentDay && 'text-primary'
                          )}>
                            {format(date, 'd')}
                          </span>
                          <div className="mt-1 space-y-1">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className="text-xs px-1.5 py-0.5 rounded truncate"
                                style={{
                                  backgroundColor: `${event.color}20`,
                                  color: event.color
                                }}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-surface-500 px-1">
                                +{dayEvents.length - 2} meer
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-surface-700 mb-3">Event Types</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(eventLabels).map(([type, label]) => {
                  const Icon = eventIcons[type as EventType]
                  return (
                    <div key={type} className="flex items-center gap-1.5 text-sm text-surface-600">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Details Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              {selectedDate ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-surface-900">
                        {format(selectedDate, 'd MMMM yyyy', { locale: nl })}
                      </h3>
                      <p className="text-sm text-surface-500">
                        {format(selectedDate, 'EEEE', { locale: nl })}
                      </p>
                    </div>
                    {isToday(selectedDate) && (
                      <Badge variant="default">Vandaag</Badge>
                    )}
                  </div>

                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-10 w-10 text-surface-300 mx-auto mb-3" />
                      <p className="text-surface-500">Geen events op deze dag</p>
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
                        const Icon = eventIcons[event.event_type] || Calendar
                        return (
                          <div
                            key={event.id}
                            className="p-3 rounded-xl border border-surface-200"
                            style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <Icon className="h-4 w-4 mt-0.5" style={{ color: event.color }} />
                                <div>
                                  <h4 className="font-medium text-surface-900">{event.title}</h4>
                                  <p className="text-xs text-surface-500">
                                    {eventLabels[event.event_type]}
                                  </p>
                                </div>
                              </div>
                              {!event.is_global && (
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="p-1 hover:bg-red-50 rounded text-surface-400 hover:text-red-500 transition-colors"
                                  disabled={deletingId === event.id}
                                >
                                  {deletingId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-sm text-surface-600 mt-2">
                                {event.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                              {event.is_global && (
                                <Badge variant="outline" className="text-xs">
                                  <Globe className="h-3 w-3 mr-1" />
                                  Globaal
                                </Badge>
                              )}
                              {event.client && (
                                <Badge variant="secondary" className="text-xs">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {event.client.name}
                                </Badge>
                              )}
                              {!event.is_global && !event.client && (
                                <Badge variant="outline" className="text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  Persoonlijk
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-surface-300 mx-auto mb-4" />
                  <h3 className="font-medium text-surface-900 mb-2">Selecteer een dag</h3>
                  <p className="text-sm text-surface-500">
                    Klik op een dag om de events te bekijken
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <AddEventDialog
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        onEventAdded={fetchEvents}
        clients={clients}
        selectedClientId={selectedClient?.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
