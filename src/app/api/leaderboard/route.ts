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
async function getMonthlyLeaderboardFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentUserId: string,
  limit: number
) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Get usage with tool info for this month
  const { data: usage } = await supabase
    .from('usage')
    .select('user_id, tool')
    .gte('created_at', startOfMonth.toISOString())

  // Get XP rewards per tool
  const { data: templates } = await supabase
    .from('prompt_templates')
    .select('key, xp_reward')

  const xpRewardMap: Record<string, number> = {}
  templates?.forEach(t => {
    xpRewardMap[t.key] = t.xp_reward || 10
  })

  // Count and calculate XP per user
  const userStats: Record<string, { count: number; xp: number }> = {}
  usage?.forEach(u => {
    if (!userStats[u.user_id]) {
      userStats[u.user_id] = { count: 0, xp: 0 }
    }
    userStats[u.user_id].count++
    // Get XP for this tool, default 5 for chat, 10 for others
    const toolXp = xpRewardMap[u.tool] || (u.tool.startsWith('chat') ? 5 : 10)
    userStats[u.user_id].xp += toolXp
  })

  // Get profiles for users with activity
  const userIds = Object.keys(userStats)
  if (userIds.length === 0) {
    return NextResponse.json({
      leaderboard: [],
      userRank: null,
      period: 'monthly',
    })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, level, xp')
    .in('id', userIds)

  // Get streaks
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak')
    .in('user_id', userIds)

  const streakMap: Record<string, number> = {}
  streaks?.forEach(s => {
    streakMap[s.user_id] = s.current_streak || 0
  })

  // Build leaderboard - sort by generations this month
  const leaderboard = profiles?.map(p => ({
    user_id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    level: p.level || 1,
    xp: p.xp || 0, // Total XP for level title calculation
    total_generations: 0, // Not available in monthly view
    generations_this_month: userStats[p.id]?.count || 0,
    current_streak: streakMap[p.id] || 0,
    achievement_count: 0,
    rank: 0,
  }))
    .sort((a, b) => b.generations_this_month - a.generations_this_month)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 })) || []

  const userRank = leaderboard.findIndex(entry => entry.user_id === currentUserId)

  return NextResponse.json({
    leaderboard,
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
