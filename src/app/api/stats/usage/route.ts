import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch user's tool usage statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all' // 'all', 'month', 'week'

    // Build date filter
    let dateFilter: Date | null = null
    if (period === 'month') {
      dateFilter = new Date()
      dateFilter.setDate(1)
      dateFilter.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 7)
      dateFilter.setHours(0, 0, 0, 0)
    }

    // Get tool templates for display names
    const { data: templates } = await supabase
      .from('prompt_templates')
      .select('key, name, xp_reward')

    interface Template { key: string; name: string; xp_reward: number }
    const templateMap = new Map((templates as Template[] || []).map((t: Template) => [t.key, { name: t.name, xp: t.xp_reward }]))

    // Get usage data
    let query = supabase
      .from('usage')
      .select('tool, created_at')
      .eq('user_id', user.id)

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString())
    }

    const { data: usage, error: usageError } = await query

    if (usageError) {
      console.error('Error fetching usage:', usageError)
      return NextResponse.json({ error: 'Could not fetch usage data' }, { status: 500 })
    }

    // Aggregate by tool
    const toolCounts: Record<string, { count: number; xpEarned: number; name: string }> = {}
    interface UsageRow { tool: string; created_at: string }

    (usage as UsageRow[] || []).forEach((u: UsageRow) => {
      const tool = u.tool
      const templateInfo = templateMap.get(tool)
      const xpPerUse = templateInfo?.xp || 10
      const displayName = templateInfo?.name || formatToolName(tool)

      if (!toolCounts[tool]) {
        toolCounts[tool] = { count: 0, xpEarned: 0, name: displayName }
      }
      toolCounts[tool].count++
      toolCounts[tool].xpEarned += xpPerUse
    })

    // Convert to array and sort by count
    const toolStats = Object.entries(toolCounts)
      .map(([key, data]) => ({
        tool: key,
        name: data.name,
        count: data.count,
        xpEarned: data.xpEarned,
      }))
      .sort((a, b) => b.count - a.count)

    // Get daily activity for chart
    const dailyActivity = getDailyActivity(usage || [], period === 'week' ? 7 : period === 'month' ? 30 : 90)

    // Get totals
    const totalGenerations = usage?.length || 0
    const totalXpEarned = toolStats.reduce((sum, t) => sum + t.xpEarned, 0)

    // Get activity by hour (for heatmap)
    const hourlyActivity = getHourlyActivity(usage || [])

    return NextResponse.json({
      toolStats,
      dailyActivity,
      hourlyActivity,
      totalGenerations,
      totalXpEarned,
      period,
    })

  } catch (error) {
    console.error('Usage stats error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van statistieken.' },
      { status: 500 }
    )
  }
}

// Format tool key to display name
function formatToolName(key: string): string {
  const names: Record<string, string> = {
    'google-ads-copy': 'Google Ads Teksten',
    'google-ads-feed': 'Feed Optimalisatie',
    'social-copy': 'Social Media Posts',
    'seo-content': 'SEO Content',
    'seo-meta': 'Meta Tags',
    'cro-analyzer': 'CRO Analyzer',
    'chat': 'Chat',
    'image-prompt': 'Image Prompts',
  }
  return names[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Get daily activity counts
function getDailyActivity(usage: { created_at: string }[], days: number) {
  const activity: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Initialize all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const key = date.toISOString().split('T')[0]
    activity[key] = 0
  }

  // Count usage per day
  usage.forEach(u => {
    const date = new Date(u.created_at).toISOString().split('T')[0]
    if (date in activity) {
      activity[date]++
    }
  })

  // Convert to array
  return Object.entries(activity).map(([date, count]) => ({
    date,
    count,
    dayName: new Date(date).toLocaleDateString('nl-NL', { weekday: 'short' }),
  }))
}

// Get hourly activity for heatmap
function getHourlyActivity(usage: { created_at: string }[]) {
  const hours = Array(24).fill(0)

  usage.forEach(u => {
    const hour = new Date(u.created_at).getHours()
    hours[hour]++
  })

  return hours.map((count, hour) => ({
    hour,
    count,
    label: `${hour.toString().padStart(2, '0')}:00`,
  }))
}
