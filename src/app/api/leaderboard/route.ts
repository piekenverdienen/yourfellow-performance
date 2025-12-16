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

  // Get usage counts per user for this month
  const { data: usage } = await supabase
    .from('usage')
    .select('user_id')
    .gte('created_at', startOfMonth.toISOString())

  // Count per user
  const userCounts: Record<string, number> = {}
  usage?.forEach(u => {
    userCounts[u.user_id] = (userCounts[u.user_id] || 0) + 1
  })

  // Get profiles for users with activity
  const userIds = Object.keys(userCounts)
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

  // Build leaderboard
  const leaderboard = profiles?.map(p => ({
    user_id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    level: p.level,
    generations_this_month: userCounts[p.id] || 0,
    xp_this_month: (userCounts[p.id] || 0) * 10, // Approximate
    current_streak: 0,
    rank: 0,
  }))
    .sort((a, b) => b.xp_this_month - a.xp_this_month)
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
