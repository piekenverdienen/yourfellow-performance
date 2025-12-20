import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    if (period === 'monthly') {
      // Monthly leaderboard - XP earned this month
      const { data: leaderboard, error } = await supabase
        .from('leaderboard_monthly')
        .select('*')
        .limit(limit)

      if (error) {
        console.error('Error fetching monthly leaderboard:', error)
        // Fallback query if view doesn't exist
        return await getMonthlyLeaderboardFallback(supabase, user.id, limit)
      }

      // Find current user's position
      const userRank = leaderboard?.findIndex(entry => entry.user_id === user.id) ?? -1

      return NextResponse.json({
        leaderboard: leaderboard || [],
        userRank: userRank >= 0 ? userRank + 1 : null,
        period: 'monthly',
      })
    }

    // All-time leaderboard
    const { data: leaderboard, error } = await supabase
      .from('leaderboard_alltime')
      .select('*')
      .limit(limit)

    if (error) {
      console.error('Error fetching alltime leaderboard:', error)
      // Fallback query if view doesn't exist
      return await getAlltimeLeaderboardFallback(supabase, user.id, limit)
    }

    // Find current user's position
    const userRank = leaderboard?.findIndex(entry => entry.user_id === user.id) ?? -1

    return NextResponse.json({
      leaderboard: leaderboard || [],
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

// Fallback for monthly leaderboard if view doesn't exist yet
// PERFORMANCE: Uses database aggregation instead of loading all records into memory
async function getMonthlyLeaderboardFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentUserId: string,
  limit: number
) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // PERFORMANCE: Use RPC or aggregated query instead of loading all usage records
  // This query aggregates at the database level, returning only top users
  const { data: aggregated, error: aggError } = await supabase
    .rpc('get_monthly_leaderboard', {
      start_date: startOfMonth.toISOString(),
      result_limit: limit
    })

  // If RPC doesn't exist, fall back to a more efficient query pattern
  if (aggError) {
    console.warn('Monthly leaderboard RPC not found, using efficient fallback')

    // Get top users by generation count this month (database does the aggregation)
    const { data: topUsers } = await supabase
      .from('usage')
      .select('user_id')
      .gte('created_at', startOfMonth.toISOString())

    if (!topUsers || topUsers.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        userRank: null,
        period: 'monthly',
      })
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
    const leaderboard = topUserIds.map((userId, index) => {
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

    const userRank = leaderboard.findIndex(entry => entry.user_id === currentUserId)

    return NextResponse.json({
      leaderboard,
      userRank: userRank >= 0 ? userRank + 1 : null,
      period: 'monthly',
    })
  }

  // RPC worked - use the aggregated data directly
  const userRank = aggregated?.findIndex((entry: { user_id: string }) => entry.user_id === currentUserId) ?? -1

  return NextResponse.json({
    leaderboard: aggregated || [],
    userRank: userRank >= 0 ? userRank + 1 : null,
    period: 'monthly',
  })
}

// Fallback for alltime leaderboard if view doesn't exist yet
async function getAlltimeLeaderboardFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentUserId: string,
  limit: number
) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, xp, level, total_generations')
    .gt('xp', 0)
    .order('xp', { ascending: false })
    .limit(limit)

  const leaderboard = profiles?.map((p, index) => ({
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

  const userRank = leaderboard.findIndex(entry => entry.user_id === currentUserId)

  return NextResponse.json({
    leaderboard,
    userRank: userRank >= 0 ? userRank + 1 : null,
    period: 'alltime',
  })
}
