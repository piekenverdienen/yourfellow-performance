import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's streak data
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's streak
    const { data: streak, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (streakError && streakError.code !== 'PGRST116') {
      console.error('Error fetching streak:', streakError)
    }

    // Check if streak is still active (last activity was yesterday or today)
    let isActive = false
    let currentStreak = 0
    let longestStreak = 0

    if (streak) {
      const lastActivity = streak.last_activity_date ? new Date(streak.last_activity_date) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      if (lastActivity) {
        const lastActivityDate = new Date(lastActivity)
        lastActivityDate.setHours(0, 0, 0, 0)
        isActive = lastActivityDate >= yesterday
      }

      currentStreak = isActive ? streak.current_streak : 0
      longestStreak = streak.longest_streak
    }

    // Calculate next streak bonus
    let nextBonus = 0
    let daysUntilBonus = 0
    if (currentStreak < 3) {
      nextBonus = 10
      daysUntilBonus = 3 - currentStreak
    } else if (currentStreak < 7) {
      nextBonus = 25
      daysUntilBonus = 7 - currentStreak
    } else if (currentStreak < 30) {
      nextBonus = 100
      daysUntilBonus = 30 - currentStreak
    }

    return NextResponse.json({
      currentStreak,
      longestStreak,
      isActive,
      lastActivityDate: streak?.last_activity_date || null,
      nextBonus,
      daysUntilBonus,
    })

  } catch (error) {
    console.error('Streak error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van je streak.' },
      { status: 500 }
    )
  }
}

// POST - Update streak (called after generation)
export async function POST() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the update_user_streak function
    const { data: streakResult, error } = await supabase
      .rpc('update_user_streak', { user_uuid: user.id })

    if (error) {
      console.error('Error updating streak:', error)
      // Fallback: manually update streak
      return await updateStreakFallback(supabase, user.id)
    }

    const result = streakResult?.[0] || { new_streak: 1, streak_bonus: 0, is_new_record: false }

    // If there's a bonus, add it to user's XP
    if (result.streak_bonus > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', user.id)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ xp: profile.xp + result.streak_bonus })
          .eq('id', user.id)
      }
    }

    return NextResponse.json({
      currentStreak: result.new_streak,
      streakBonus: result.streak_bonus,
      isNewRecord: result.is_new_record,
      message: result.streak_bonus > 0
        ? `Streak bonus! +${result.streak_bonus} XP`
        : result.is_new_record
          ? 'Nieuwe streak record!'
          : null,
    })

  } catch (error) {
    console.error('Update streak error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het updaten van je streak.' },
      { status: 500 }
    )
  }
}

// Fallback streak update if RPC doesn't exist
async function updateStreakFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Get current streak data
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  let currentStreak = 1
  let longestStreak = 1
  let isNewRecord = false

  if (existing) {
    const lastDate = existing.last_activity_date
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (lastDate === todayStr) {
      // Already logged today, no change
      return NextResponse.json({
        currentStreak: existing.current_streak,
        streakBonus: 0,
        isNewRecord: false,
      })
    } else if (lastDate === yesterdayStr) {
      // Consecutive day
      currentStreak = existing.current_streak + 1
    }
    // else streak resets to 1

    longestStreak = Math.max(existing.longest_streak, currentStreak)
    isNewRecord = currentStreak > existing.longest_streak

    await supabase
      .from('user_streaks')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: todayStr,
        streak_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  } else {
    // Create new streak record
    await supabase
      .from('user_streaks')
      .insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: todayStr,
      })
  }

  // Calculate bonus
  let bonus = 0
  if (currentStreak >= 30) bonus = 100
  else if (currentStreak >= 7) bonus = 25
  else if (currentStreak >= 3) bonus = 10

  return NextResponse.json({
    currentStreak,
    streakBonus: bonus,
    isNewRecord,
  })
}
