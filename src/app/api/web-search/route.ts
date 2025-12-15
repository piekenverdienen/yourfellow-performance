import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

interface SearchResult {
  title: string
  url: string
  content: string
  score?: number
}

interface TavilyResponse {
  results: Array<{
    title: string
    url: string
    content: string
    score: number
  }>
  query: string
}

interface WebSearchRequest {
  query: string
  maxResults?: number
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json(
        { error: 'WebSearch API niet geconfigureerd' },
        { status: 500 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    const body: WebSearchRequest = await request.json()
    const { query, maxResults = 5 } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Zoekopdracht is vereist' },
        { status: 400 }
      )
    }

    // Call Tavily API
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        search_depth: 'basic',
      }),
    })

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text()
      console.error('Tavily API error:', errorText)
      return NextResponse.json(
        { error: 'Zoekopdracht mislukt' },
        { status: 500 }
      )
    }

    const data: TavilyResponse = await tavilyResponse.json()

    // Format results
    const results: SearchResult[] = data.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
    }))

    // Track usage
    await supabase.from('usage').insert({
      user_id: user.id,
      tool: 'web-search',
      total_tokens: 0, // No tokens for search
    })

    // Add XP (3 XP per search)
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + 3
      const newLevel = Math.floor(newXp / 100) + 1

      await supabase
        .from('profiles')
        .update({ xp: newXp, level: newLevel })
        .eq('id', user.id)
    }

    return NextResponse.json({
      query: data.query,
      results,
    })
  } catch (error) {
    console.error('WebSearch API error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het zoeken' },
      { status: 500 }
    )
  }
}
