'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useUser } from '@/hooks/use-user'
import {
  Star,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Type,
  Image as ImageIcon,
  Tags,
  BarChart3,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { getGreeting, calculateLevel, getLevelRange } from '@/lib/utils'
import { cn } from '@/lib/utils'

const recentTools = [
  { name: 'Website Analyseren', icon: BarChart3, href: '/cro/analyzer', color: 'text-purple-500' },
  { name: 'Ad Teksten', icon: Type, href: '/google-ads/copy', color: 'text-blue-500' },
  { name: 'Meta Tags', icon: Tags, href: '/seo/meta', color: 'text-green-500' },
]

const aiAssistants = [
  {
    name: 'Antonio',
    role: 'Algemene assistent',
    avatar: null,
    available: true,
  },
  {
    name: 'Elliot',
    role: 'Developer assistant',
    avatar: null,
    available: true,
  },
  {
    name: 'Lisa',
    role: 'Neuromarketing expert',
    avatar: null,
    available: true,
  },
]

interface NewsItem {
  id: string
  title: string
  url: string
  date: string
  source: string
}

interface MarketingEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: string
  color: string
  is_global: boolean
}

interface Generation {
  id: string
  tool: string
  input: { prompt?: string }
  output: { imageUrl?: string; revisedPrompt?: string }
  rating: number | null
  is_favorite: boolean
  created_at: string
}

// Month descriptions for the calendar
const monthDescriptions: Record<number, string> = {
  1: 'Het nieuwe jaar is begonnen! Perfect moment voor goede voornemens campagnes en verse start promoties.',
  2: 'Februari staat in het teken van Valentijnsdag. Ideaal voor romantische en relatiemarketing.',
  3: 'Lente breekt aan! Tijd voor voorjaarsschoonmaak en vernieuwing campagnes.',
  4: 'April brengt Pasen en het begin van het terrasseizoen. Focus op familie en buitenactiviteiten.',
  5: 'Moederdag in mei! Een belangrijke commerciële periode voor cadeaus en belevenissen.',
  6: 'Zomer begint met Vaderdag en vakantievoorbereidingen. Denk aan reizen en outdoor.',
  7: 'Volle zomer! Vakantie, zomeropruiming en festivalseizoen bieden veel kansen.',
  8: 'Back-to-school periode start. Ouders en studenten bereiden zich voor op het nieuwe jaar.',
  9: 'Nazomer en herfst beginnen. Nieuwe start voor veel consumenten na de vakantie.',
  10: 'Halloween en herfstpromoties. Begin ook met Black Friday voorbereidingen.',
  11: 'Singles Day (11/11) en Black Friday. De belangrijkste shopping maand van het jaar!',
  12: 'We sluiten het jaar af met de feestmaand december. Hier valt veel winst te behalen vanuit een goede contentstrategie, in december wordt er onder andere Sinterklaas en Kerst gevierd.',
}

export default function DashboardPage() {
  const { user, stats, loading, refetch } = useUser()

  // State for news
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  // State for calendar navigation
  const now = new Date()
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth())

  // State for marketing events
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

  // State for generated media
  const [generations, setGenerations] = useState<Generation[]>([])
  const [generationsLoading, setGenerationsLoading] = useState(true)

  const greeting = getGreeting()

  // Fetch news
  const fetchNews = useCallback(async () => {
    setNewsLoading(true)
    try {
      const res = await fetch('/api/news')
      const data = await res.json()
      setNews(data.news || [])
    } catch (error) {
      console.error('Error fetching news:', error)
      setNews([])
    } finally {
      setNewsLoading(false)
    }
  }, [])

  // Fetch calendar events
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true)
    try {
      const res = await fetch(`/api/calendar/events?year=${calendarYear}&month=${calendarMonth + 1}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [calendarYear, calendarMonth])

  // Fetch generated media
  const fetchGenerations = useCallback(async () => {
    setGenerationsLoading(true)
    try {
      const res = await fetch('/api/generations?limit=4&tool=social-image')
      const data = await res.json()
      setGenerations(data.generations || [])
    } catch (error) {
      console.error('Error fetching generations:', error)
      setGenerations([])
    } finally {
      setGenerationsLoading(false)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    fetchNews()
    fetchGenerations()
  }, [fetchNews, fetchGenerations])

  // Fetch events when calendar month changes
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Calendar navigation handlers
  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear(calendarYear - 1)
    } else {
      setCalendarMonth(calendarMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear(calendarYear + 1)
    } else {
      setCalendarMonth(calendarMonth + 1)
    }
  }

  const goToToday = () => {
    setCalendarYear(now.getFullYear())
    setCalendarMonth(now.getMonth())
  }

  // Generate calendar data
  const calendarDays = generateCalendarDays(calendarYear, calendarMonth, events)
  const displayMonth = new Date(calendarYear, calendarMonth).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const weekNumber = getWeekNumber(new Date(calendarYear, calendarMonth, 15))
  const monthDescription = monthDescriptions[calendarMonth + 1] || 'Een nieuwe maand vol mogelijkheden voor je marketing!'

  // Get events for the displayed month
  const displayedEvents = events
    .filter(event => {
      const eventDate = new Date(event.event_date)
      return eventDate.getMonth() === calendarMonth && eventDate.getFullYear() === calendarYear
    })
    .slice(0, 3)

  // Calculate level info from user XP
  const xp = user?.xp || 0
  const levelInfo = calculateLevel(xp)
  const levelRange = getLevelRange(levelInfo.level)

  // User display data
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Gebruiker'
  const todayUsage = stats?.generations_today || 0
  const totalUsage = stats?.total_generations || user?.total_generations || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Welcome Card */}
          <Card className="bg-gradient-to-br from-surface-50 to-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Level indicator */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="text-sm font-medium">{levelInfo.title}</span>
                    <span className="text-xs text-surface-500">Lvl.{levelInfo.level}</span>
                    <div className="w-20 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${levelInfo.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-500">{xp} / {levelRange.max} XP ({Math.round(levelInfo.progress)}%)</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <Avatar name={userName} size="xl" />
                <div>
                  <h1 className="text-2xl font-bold text-surface-900">
                    {greeting} {userName}!
                  </h1>
                  <p className="text-surface-600 mt-1">
                    Je zit op level <span className="text-primary font-medium">{levelInfo.title}</span> met{' '}
                    <span className="text-primary font-medium">{xp}</span> van de{' '}
                    <span className="text-primary font-medium">{levelRange.max}</span> XP{' '}
                    <span className="text-primary font-medium">({Math.round(levelInfo.progress)}%)</span>.
                  </p>
                  <p className="text-surface-600">
                    Vandaag heb je <span className="text-primary font-medium">{todayUsage}</span> keer de AI gebruikt, in totaal al{' '}
                    <span className="text-primary font-medium">{totalUsage}</span> keer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tools Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chat with AI */}
            <Card padding="none" className="overflow-hidden">
              <CardHeader className="p-4 pb-2 flex-row items-center justify-between">
                <CardTitle className="text-base">Chat met een AI</CardTitle>
                <ChevronRight className="h-4 w-4 text-surface-400" />
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {aiAssistants.map((assistant) => (
                  <Link
                    key={assistant.name}
                    href={`/chat/${assistant.name.toLowerCase()}`}
                    className="flex items-center gap-3 hover:bg-surface-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <Avatar name={assistant.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-surface-900">{assistant.name}</p>
                      <p className="text-xs text-surface-500">{assistant.role}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Recent Tools */}
            <Card padding="none" className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Laatst gebruikte tools</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {recentTools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.name}
                      href={tool.href}
                      className="flex items-center gap-3 hover:bg-surface-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                    >
                      <div className={cn('p-2 rounded-lg bg-surface-100', tool.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-surface-700">{tool.name}</span>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card padding="none" className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Jouw gebruik</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="flex items-baseline gap-4 mb-4">
                  <div>
                    <p className="text-xs text-surface-500">Vandaag</p>
                    <p className="text-2xl font-bold text-surface-900">{todayUsage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Totaal generaties</p>
                    <p className="text-2xl font-bold text-surface-900">{totalUsage}</p>
                  </div>
                </div>
                {/* XP Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-surface-500">
                    <span>Level {levelInfo.level} voortgang</span>
                    <span>{levelInfo.xpForNext} XP tot level {levelInfo.level + 1}</span>
                  </div>
                  <Progress value={levelInfo.progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Calendar & Events */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Latest News */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="p-4 flex-row items-center justify-between">
              <CardTitle className="text-base">Laatste nieuws</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={fetchNews}
                disabled={newsLoading}
              >
                <RefreshCw className={cn('h-3 w-3', newsLoading && 'animate-spin')} />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {newsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                </div>
              ) : news.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-4">Geen nieuws beschikbaar</p>
              ) : (
                news.slice(0, 3).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 group hover:bg-surface-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <div className="w-16 h-12 bg-surface-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-surface-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-surface-500">{item.source}</p>
                    </div>
                  </a>
                ))
              )}
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={goToPreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={goToToday}
                  >
                    Vandaag
                  </Button>
                </div>
                <CardTitle className="text-base capitalize">{displayMonth}</CardTitle>
                <span className="text-sm text-surface-500">Week {weekNumber}</span>
              </div>
              <p className="text-xs text-surface-500 mt-2">
                {monthDescription}
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {/* Mini calendar grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                  <div key={day} className={cn(
                    'py-1 font-medium',
                    ['Za', 'Zo'].includes(day) ? 'text-red-400' : 'text-surface-500'
                  )}>
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'py-1 rounded-full text-sm relative',
                      day.isToday && 'bg-primary text-black font-bold',
                      day.hasEvent && !day.isToday && 'font-semibold',
                      !day.isCurrentMonth && 'text-surface-300',
                      day.isWeekend && !day.isToday && day.isCurrentMonth && 'text-red-400',
                    )}
                    title={day.eventTitle}
                  >
                    {day.date}
                    {day.hasEvent && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ backgroundColor: day.eventColor || '#EF4444' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Marketing Events */}
              <div className="border-t border-surface-100 pt-3 space-y-2">
                <h4 className="text-xs font-semibold text-surface-500 uppercase">Marketingevents</h4>
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
                  </div>
                ) : displayedEvents.length === 0 ? (
                  <p className="text-xs text-surface-400 py-2">Geen events deze maand</p>
                ) : (
                  displayedEvents.map((event) => {
                    const eventDate = new Date(event.event_date)
                    const formattedDate = eventDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
                    return (
                      <div key={event.id} className="flex items-center gap-2">
                        <div
                          className="w-1 h-4 rounded-full"
                          style={{ backgroundColor: event.color }}
                        />
                        <div>
                          <p className="text-sm font-medium" style={{ color: event.color }}>{event.title}</p>
                          <p className="text-xs text-surface-500">{formattedDate}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Media */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="p-4 flex-row items-center justify-between">
              <CardTitle className="text-base">Gegenereerde media</CardTitle>
              <Link href="/social/images">
                <ChevronRight className="h-4 w-4 text-surface-400 hover:text-primary transition-colors" />
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {generationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                </div>
              ) : generations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
                    <ImageIcon className="h-6 w-6 text-surface-400" />
                  </div>
                  <p className="text-sm text-surface-500 mb-3">Nog geen media gegenereerd</p>
                  <Link href="/social/images">
                    <Button variant="outline" size="sm">
                      Start met creëren
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {generations.slice(0, 4).map((gen) => (
                      <div
                        key={gen.id}
                        className="aspect-square rounded-lg bg-surface-100 overflow-hidden relative group"
                      >
                        {gen.output.imageUrl ? (
                          <img
                            src={gen.output.imageUrl}
                            alt={gen.input.prompt || 'Generated image'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If image fails to load (expired URL), show placeholder
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <div className={cn(
                          'absolute inset-0 flex items-center justify-center bg-surface-100',
                          gen.output.imageUrl ? 'hidden' : ''
                        )}>
                          <ImageIcon className="h-6 w-6 text-surface-400" />
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-xs text-white text-center p-2 line-clamp-3">
                            {gen.input.prompt || 'Gegenereerde afbeelding'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/social/images" className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      Bekijk alle media
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

interface CalendarDay {
  date: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  hasEvent: boolean
  eventColor?: string
  eventTitle?: string
}

function generateCalendarDays(year: number, month: number, events: MarketingEvent[]): CalendarDay[] {
  const now = new Date()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
  const days: CalendarDay[] = []

  // Create a map of events by date
  const eventMap = new Map<string, MarketingEvent>()
  events.forEach(event => {
    const dateKey = event.event_date.split('T')[0]
    eventMap.set(dateKey, event)
  })

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    const dateKey = d.toISOString().split('T')[0]
    const event = eventMap.get(dateKey)
    days.push({
      date: d.getDate(),
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: !!event,
      eventColor: event?.color,
      eventTitle: event?.title,
    })
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    const dateKey = d.toISOString().split('T')[0]
    const event = eventMap.get(dateKey)
    const isToday = d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear()
    days.push({
      date: i,
      isCurrentMonth: true,
      isToday,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: !!event,
      eventColor: event?.color,
      eventTitle: event?.title,
    })
  }

  // Next month days to fill the grid
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    const dateKey = d.toISOString().split('T')[0]
    const event = eventMap.get(dateKey)
    days.push({
      date: i,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: !!event,
      eventColor: event?.color,
      eventTitle: event?.title,
    })
  }

  return days.slice(0, 35) // 5 weeks
}
