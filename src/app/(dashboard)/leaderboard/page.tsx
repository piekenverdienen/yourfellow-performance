'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useUser } from '@/hooks/use-user'
import { calculateLevel, formatNumber, cn } from '@/lib/utils'
import {
  Trophy,
  Medal,
  Flame,
  Zap,
  Crown,
  TrendingUp,
  Calendar,
  BarChart3,
  Users,
  Loader2,
  ChevronUp,
  Star,
  Target,
  Award,
  Heart,
  Send,
} from 'lucide-react'

interface LeaderboardEntry {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  xp: number
  level: number
  total_generations: number
  current_streak: number
  longest_streak: number
  achievement_count: number
  rank: number
  // Monthly specific
  xp_this_month?: number
  generations_this_month?: number
}

interface ToolStat {
  tool: string
  name: string
  count: number
  xpEarned: number
}

interface KudosEntry {
  id: string
  message: string | null
  xp_amount: number
  created_at: string
  from_user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export default function LeaderboardPage() {
  const { user } = useUser()
  const [period, setPeriod] = useState<'alltime' | 'monthly'>('monthly')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [toolStats, setToolStats] = useState<ToolStat[]>([])
  const [kudosData, setKudosData] = useState<{
    received: KudosEntry[]
    remaining: number
    totalReceived: number
  }>({ received: [], remaining: 3, totalReceived: 0 })
  const [loading, setLoading] = useState(true)
  const [sendingKudos, setSendingKudos] = useState<string | null>(null)

  // Fetch leaderboard data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [leaderboardRes, statsRes, kudosRes] = await Promise.all([
          fetch(`/api/leaderboard?period=${period}`),
          fetch('/api/stats/usage?period=month'),
          fetch('/api/kudos'),
        ])

        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json()
          setLeaderboard(data.leaderboard || [])
          setUserRank(data.userRank)
        }

        if (statsRes.ok) {
          const data = await statsRes.json()
          setToolStats(data.toolStats || [])
        }

        if (kudosRes.ok) {
          const data = await kudosRes.json()
          setKudosData({
            received: data.receivedKudos || [],
            remaining: data.kudosRemaining ?? 3,
            totalReceived: data.totalReceived || 0,
          })
        }
      } catch (error) {
        console.error('Error fetching leaderboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period])

  // Send kudos to a user
  async function sendKudos(toUserId: string) {
    if (sendingKudos || kudosData.remaining <= 0) return
    setSendingKudos(toUserId)

    try {
      const res = await fetch('/api/kudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId }),
      })

      if (res.ok) {
        const data = await res.json()
        setKudosData(prev => ({
          ...prev,
          remaining: data.kudosRemaining,
        }))
      }
    } catch (error) {
      console.error('Error sending kudos:', error)
    } finally {
      setSendingKudos(null)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-surface-500 font-medium">{rank}</span>
    }
  }

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
      default:
        return 'bg-white border-surface-100'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentUserEntry = leaderboard.find(e => e.user_id === user?.id)
  const levelInfo = user ? calculateLevel(user.xp || 0) : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            Leaderboard
          </h1>
          <p className="text-surface-600 mt-1">
            Bekijk wie de beste performer is binnen het team
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-100 rounded-xl">
          <Button
            variant={period === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPeriod('monthly')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Deze Maand
          </Button>
          <Button
            variant={period === 'alltime' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPeriod('alltime')}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            All-Time
          </Button>
        </div>
      </div>

      {/* Your Stats Card */}
      {user && levelInfo && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar
                  src={user.avatar_url}
                  name={user.full_name || 'User'}
                  size="xl"
                />
                <div className="absolute -bottom-1 -right-1 bg-primary text-black text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center">
                  {levelInfo.level}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-bold text-surface-900">{user.full_name || 'Jij'}</h2>
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3" />
                    {levelInfo.title}
                  </Badge>
                  {userRank && (
                    <Badge variant="secondary" className="gap-1">
                      #{userRank} {period === 'monthly' ? 'deze maand' : 'all-time'}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-surface-500 mb-0.5">Totaal XP</p>
                    <p className="text-xl font-bold text-surface-900">{formatNumber(user.xp || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500 mb-0.5">Level</p>
                    <p className="text-xl font-bold text-surface-900">{levelInfo.level}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500 mb-0.5">
                      {period === 'monthly' ? 'Generaties deze maand' : 'Generaties totaal'}
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {formatNumber(period === 'monthly'
                        ? (currentUserEntry?.generations_this_month || 0)
                        : (user.total_generations || 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500 mb-0.5">Streak</p>
                    <p className="text-xl font-bold text-surface-900 flex items-center gap-1">
                      {currentUserEntry?.current_streak || 0}
                      {(currentUserEntry?.current_streak || 0) > 0 && (
                        <Flame className="h-4 w-4 text-orange-500" />
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-surface-500 mb-1">
                    <span>Voortgang naar level {levelInfo.level + 1}</span>
                    <span>{Math.round(levelInfo.progress)}%</span>
                  </div>
                  <Progress value={levelInfo.progress} className="h-2" />
                </div>
              </div>

              {/* Kudos to give */}
              <div className="text-center p-4 bg-white/50 rounded-xl">
                <Heart className="h-6 w-6 text-pink-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-surface-900">{kudosData.remaining}</p>
                <p className="text-xs text-surface-500">Kudos te geven</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Leaderboard */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-surface-500" />
                {period === 'monthly' ? 'Ranking Deze Maand' : 'All-Time Ranking'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 text-surface-300 mx-auto mb-4" />
                  <p className="text-surface-600">Nog geen data beschikbaar</p>
                  <p className="text-sm text-surface-500 mt-1">
                    Begin met genereren om op het leaderboard te komen!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => {
                    const isCurrentUser = entry.user_id === user?.id
                    // Use total XP for level title (not monthly XP)
                    const totalXp = entry.xp || 0
                    const entryLevelInfo = calculateLevel(totalXp)

                    return (
                      <div
                        key={entry.user_id}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 rounded-xl border transition-all',
                          getRankBgColor(entry.rank),
                          isCurrentUser && 'ring-2 ring-primary ring-offset-2'
                        )}
                      >
                        {/* Rank */}
                        <div className="w-10 flex justify-center flex-shrink-0">
                          {getRankIcon(entry.rank)}
                        </div>

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <Avatar
                            src={entry.avatar_url}
                            name={entry.full_name || 'User'}
                            size="md"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-surface-800 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {entry.level || entryLevelInfo.level}
                          </div>
                        </div>

                        {/* Name & Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-surface-900 truncate">
                              {entry.full_name || 'Gebruiker'}
                              {isCurrentUser && <span className="text-primary ml-1">(jij)</span>}
                            </p>
                            {entry.current_streak >= 3 && (
                              <span className="flex items-center gap-0.5 text-orange-500 text-sm">
                                <Flame className="h-3.5 w-3.5" />
                                {entry.current_streak}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-surface-500">{entryLevelInfo.title}</p>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-right flex-shrink-0">
                          <div className="w-16">
                            <p className="font-bold text-surface-900 tabular-nums">
                              {formatNumber(period === 'monthly' ? (entry.generations_this_month || 0) : entry.total_generations)}
                            </p>
                            <p className="text-xs text-surface-500">
                              {period === 'monthly' ? 'Generaties' : 'Generaties'}
                            </p>
                          </div>
                          <div className="w-16 hidden sm:block">
                            <p className="font-bold text-surface-900 tabular-nums">
                              {formatNumber(entry.xp || 0)}
                            </p>
                            <p className="text-xs text-surface-500">XP</p>
                          </div>
                          <div className="w-14 hidden md:block">
                            <p className="font-bold text-surface-900 flex items-center justify-end gap-1 tabular-nums">
                              {entry.achievement_count > 0 && <Award className="h-4 w-4 text-amber-500" />}
                              {entry.achievement_count || 0}
                            </p>
                            <p className="text-xs text-surface-500">Badges</p>
                          </div>
                        </div>

                        {/* Kudos Button */}
                        {!isCurrentUser && kudosData.remaining > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendKudos(entry.user_id)}
                            disabled={sendingKudos === entry.user_id}
                            className="text-pink-500 hover:text-pink-600 hover:bg-pink-50"
                          >
                            {sendingKudos === entry.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Heart className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tool Usage Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-surface-500" />
                Jouw Tool Gebruik
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {toolStats.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-4">
                  Nog geen gebruik deze maand
                </p>
              ) : (
                <div className="space-y-2.5">
                  {toolStats.slice(0, 6).map((stat, index) => {
                    const maxCount = toolStats[0]?.count || 1
                    const percentage = (stat.count / maxCount) * 100

                    return (
                      <div key={stat.tool}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-surface-700 truncate pr-2">
                            {stat.name}
                          </span>
                          <span className="text-sm text-surface-500 flex-shrink-0">
                            {stat.count}x
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              index === 0 ? 'bg-primary' :
                              index === 1 ? 'bg-blue-500' :
                              index === 2 ? 'bg-purple-500' :
                              'bg-surface-300'
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5">
                          +{formatNumber(stat.xpEarned)} XP
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Kudos Received */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-5 w-5 text-pink-500" />
                Ontvangen Kudos
                {kudosData.totalReceived > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {kudosData.totalReceived} totaal
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kudosData.received.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-4">
                  Nog geen kudos ontvangen
                </p>
              ) : (
                <div className="space-y-3">
                  {kudosData.received.slice(0, 5).map((kudos) => (
                    <div
                      key={kudos.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-pink-50/50"
                    >
                      <Avatar
                        src={kudos.from_user?.avatar_url}
                        name={kudos.from_user?.full_name || 'User'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate">
                          {kudos.from_user?.full_name || 'Iemand'}
                        </p>
                        <p className="text-xs text-surface-500">
                          +{kudos.xp_amount} XP
                        </p>
                      </div>
                      <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Streak Info */}
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Flame className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Streak Bonussen</p>
                  <p className="text-sm text-surface-600">
                    Verdien extra XP door dagelijks actief te zijn
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-600">3 dagen streak</span>
                  <span className="font-medium text-orange-600">+10 XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-600">7 dagen streak</span>
                  <span className="font-medium text-orange-600">+25 XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-600">30 dagen streak</span>
                  <span className="font-medium text-orange-600">+100 XP</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
