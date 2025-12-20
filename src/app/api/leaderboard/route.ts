import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, CACHE_TTL } from '@/lib/cache'

// Type for leaderboard entries
interface LeaderboardEntry {
  user_id: string
  full_name: string
  avatar_url: string | null
  level: number
  xp: number
  total_generations?: number
  generations_this_month?: number
  current_streak: number
  achievement_count: number
  rank: number
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'alltime' // 'alltime' or 'monthly'
    const limit = parseInt(searchParams.get('limit') || '50')

    // PERFORMANCE: Cache leaderboard data (same for all users)
    const cacheKey = `leaderboard:${period}:${limit}`

    if (period === 'monthly') {
      const leaderboard = await cache.getOrFetch<LeaderboardEntry[]>(
        cacheKey,
        async () => {
          const { data, error } = await supabase
            .from('leaderboard_monthly')
            .select('*')
            .limit(limit)

          if (error) {
            console.error('Error fetching monthly leaderboard:', error)
            // Return fallback data
            return await getMonthlyLeaderboardData(supabase, limit)
          }
          return data || []
        },
        CACHE_TTL.LEADERBOARD
      )

      // Find current user's position (not cached - user-specific)
      const userRank = leaderboard.findIndex(entry => entry.user_id === user.id)

      return NextResponse.json({
        leaderboard,
        userRank: userRank >= 0 ? userRank + 1 : null,
        period: 'monthly',
      })
    }

    // All-time leaderboard
    const leaderboard = await cache.getOrFetch<LeaderboardEntry[]>(
      cacheKey,
      async () => {
        const { data, error } = await supabase
          .from('leaderboard_alltime')
          .select('*')
          .limit(limit)

        if (error) {
          console.error('Error fetching alltime leaderboard:', error)
          return await getAlltimeLeaderboardData(supabase, limit)
        }
        return data || []
      },
      CACHE_TTL.LEADERBOARD
    )

    // Find current user's position (not cached - user-specific)
    const userRank = leaderboard.findIndex(entry => entry.user_id === user.id)

    return NextResponse.json({
      leaderboard,
      userRank: userRank >= 0 ? userRank + 1 : null,
      period: 'alltime',
    })

  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van het leaderboard.' },
      { status: 500 }
    )
  }
}

// Fallback for monthly leaderboard data (returns data for caching)
// PERFORMANCE: Uses database aggregation instead of loading all records into memory
async function getMonthlyLeaderboardData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<LeaderboardEntry[]> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // PERFORMANCE: Use RPC or aggregated query instead of loading all usage records
  const { data: aggregated, error: aggError } = await supabase
    .rpc('get_monthly_leaderboard', {
      start_date: startOfMonth.toISOString(),
      result_limit: limit
    })

  // If RPC doesn't exist, fall back to a more efficient query pattern
  if (aggError) {
    console.warn('Monthly leaderboard RPC not found, using efficient fallback')

    const { data: topUsers } = await supabase
      .from('usage')
      .select('user_id')
      .gte('created_at', startOfMonth.toISOString())

    if (!topUsers || topUsers.length === 0) {
      return []
    }

    // Count generations per user in JS (but only for this month's users)
    const userCounts: Record<string, number> = {}
    for (const u of topUsers) {
      userCounts[u.user_id] = (userCounts[u.user_id] || 0) + 1
    }

    // Sort and get top N user IDs
    const topUserIds = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId]) => userId)

    // Fetch only needed profiles (limited set)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, level, xp')
      .in('id', topUserIds)

    // Fetch streaks for top users only
    const { data: streaks } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak')
      .in('user_id', topUserIds)

    const streakMap: Record<string, number> = {}
    streaks?.forEach(s => {
      streakMap[s.user_id] = s.current_streak || 0
    })

    // Build leaderboard with pre-sorted order
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
    return topUserIds.map((userId, index) => {
      const profile = profileMap.get(userId)
      return {
        user_id: userId,
        full_name: profile?.full_name || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        level: profile?.level || 1,
        xp: profile?.xp || 0,
        total_generations: 0,
        generations_this_month: userCounts[userId] || 0,
        current_streak: streakMap[userId] || 0,
        achievement_count: 0,
        rank: index + 1,
      }
    })
  }

  // RPC worked - use the aggregated data directly
  return aggregated || []
}

// Fallback for alltime leaderboard data (returns data for caching)
async function getAlltimeLeaderboardData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<LeaderboardEntry[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, xp, level, total_generations')
    .gt('xp', 0)
    .order('xp', { ascending: false })
    .limit(limit)

  return profiles?.map((p, index) => ({
    user_id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    xp: p.xp,
    level: p.level,
    total_generations: p.total_generations,
    current_streak: 0,
    longest_streak: 0,
    achievement_count: 0,
    rank: index + 1,
  })) || []
}
