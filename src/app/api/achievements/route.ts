import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  xp_reward: number
  is_active: boolean
  sort_order: number
}

// GET - Fetch all achievements and user's earned achievements
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all achievements
    const { data: allAchievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError)
      // Return empty if table doesn't exist yet
      return NextResponse.json({
        achievements: [],
        earned: [],
        totalEarned: 0,
        totalAvailable: 0,
      })
    }

    // Get user's earned achievements
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id)

    if (userAchievementsError) {
      console.error('Error fetching user achievements:', userAchievementsError)
    }

    // Build earned set
    const earnedSet = new Set(userAchievements?.map((ua: { achievement_id: string; earned_at: string }) => ua.achievement_id) || [])
    const earnedMap = new Map(userAchievements?.map((ua: { achievement_id: string; earned_at: string }) => [ua.achievement_id, ua.earned_at]) || [])

    // Combine achievements with earned status
    const achievements = (allAchievements as Achievement[] | null)?.map((ach: Achievement) => ({
      ...ach,
      earned: earnedSet.has(ach.id),
      earned_at: earnedMap.get(ach.id) || null,
    })) || []

    // Group by category
    const byCategory = achievements.reduce((acc, ach) => {
      if (!acc[ach.category]) {
        acc[ach.category] = []
      }
      acc[ach.category].push(ach)
      return acc
    }, {} as Record<string, typeof achievements>)

    return NextResponse.json({
      achievements,
      byCategory,
      earned: userAchievements || [],
      totalEarned: earnedSet.size,
      totalAvailable: allAchievements?.length || 0,
    })

  } catch (error) {
    console.error('Achievements error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van achievements.' },
      { status: 500 }
    )
  }
}

// POST - Check and award achievements
export async function POST() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the check_achievements function
    const { data: newAchievements, error } = await supabase
      .rpc('check_achievements', { user_uuid: user.id })

    if (error) {
      console.error('Error checking achievements:', error)
      return NextResponse.json({
        newAchievements: [],
        message: 'Could not check achievements',
      })
    }

    return NextResponse.json({
      newAchievements: newAchievements || [],
      message: newAchievements?.length
        ? `${newAchievements.length} nieuwe achievement(s) behaald!`
        : 'Geen nieuwe achievements',
    })

  } catch (error) {
    console.error('Check achievements error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het controleren van achievements.' },
      { status: 500 }
    )
  }
}
