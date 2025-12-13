'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useUser } from '@/hooks/use-user'
import {
  Star,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Type,
  Database,
  Image,
  FileText,
  Tags,
  BarChart3,
  RefreshCw,
  Calendar,
  TrendingUp,
  Zap,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { getGreeting, calculateLevel, formatDate, getLevelRange } from '@/lib/utils'
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

const marketingEvents = [
  { title: 'Start Winter...', date: '1 december', color: 'text-primary' },
  { title: 'Cyber Monday', date: '2 december', color: 'text-red-500' },
  { title: 'Sinterklaasavond', date: '5 december', color: 'text-orange-500' },
]

const latestNews = [
  {
    title: 'Where to Invest in AI in 2026',
    date: 'vrijdag 12 december 2025',
    image: '/placeholder-news-1.jpg',
  },
  {
    title: 'Amputees often feel disconnected from...',
    date: 'vrijdag 12 december 2025',
    image: '/placeholder-news-2.jpg',
  },
  {
    title: 'Arizona city rejects data center after AI...',
    date: 'vrijdag 12 december 2025',
    image: '/placeholder-news-3.jpg',
  },
]

export default function DashboardPage() {
  const { user, stats, loading, refetch } = useUser()

  const greeting = getGreeting()

  // Get current month calendar data
  const now = new Date()
  const currentMonth = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const weekNumber = getWeekNumber(now)

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
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {latestNews.map((news, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-16 h-12 bg-surface-200 rounded-lg flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-surface-900 line-clamp-2">{news.title}</p>
                    <p className="text-xs text-surface-500">{news.date}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-base capitalize">{currentMonth}</CardTitle>
                <span className="text-sm text-surface-500">Week {weekNumber}</span>
              </div>
              <p className="text-xs text-surface-500 mt-2">
                We sluiten het jaar af met de feestmaand december. Hier valt veel winst te behalen vanuit een goede contentstrategie, in december wordt er onder andere Sinterklaas en Kerst gevierd.
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
                {generateCalendarDays().map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'py-1 rounded-full text-sm',
                      day.isToday && 'bg-primary text-black font-bold',
                      day.hasEvent && !day.isToday && 'text-red-500',
                      !day.isCurrentMonth && 'text-surface-300',
                      day.isWeekend && !day.isToday && 'text-red-400',
                    )}
                  >
                    {day.date}
                  </div>
                ))}
              </div>

              {/* Marketing Events */}
              <div className="border-t border-surface-100 pt-3 space-y-2">
                <h4 className="text-xs font-semibold text-surface-500 uppercase">Marketingevents</h4>
                {marketingEvents.map((event, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className={cn('w-1 h-4 rounded-full', event.color.replace('text-', 'bg-'))} />
                    <div>
                      <p className={cn('text-sm font-medium', event.color)}>{event.title}</p>
                      <p className="text-xs text-surface-500">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generated Media */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="p-4 flex-row items-center justify-between">
              <CardTitle className="text-base">Gegenereerde media</CardTitle>
              <ChevronRight className="h-4 w-4 text-surface-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
                  <Image className="h-6 w-6 text-surface-400" />
                </div>
                <p className="text-sm text-surface-500 mb-3">Nog geen media gegenereerd</p>
                <Link href="/social/images">
                  <Button variant="outline" size="sm">
                    Start met creëren
                  </Button>
                </Link>
              </div>
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

function generateCalendarDays() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
  const days = []

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({
      date: d.getDate(),
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: false,
    })
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    days.push({
      date: i,
      isCurrentMonth: true,
      isToday: i === now.getDate(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: [1, 2, 5, 25, 26].includes(i), // Some example event days
    })
  }

  // Next month days to fill the grid
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({
      date: i,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      hasEvent: false,
    })
  }

  return days.slice(0, 35) // 5 weeks
}
