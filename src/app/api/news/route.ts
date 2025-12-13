import { NextResponse } from 'next/server'

interface HNStory {
  id: number
  title: string
  url?: string
  time: number
  score: number
}

interface NewsItem {
  id: string
  title: string
  url: string
  date: string
  source: string
}

// Fetch top AI/tech news from Hacker News API (free, no key required)
export async function GET() {
  try {
    // Get top story IDs
    const topStoriesRes = await fetch(
      'https://hacker-news.firebaseio.com/v0/topstories.json',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    )

    if (!topStoriesRes.ok) {
      throw new Error('Failed to fetch top stories')
    }

    const storyIds: number[] = await topStoriesRes.json()

    // Fetch first 20 stories to filter AI/tech related ones
    const storyPromises = storyIds.slice(0, 20).map(async (id) => {
      const res = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
        { next: { revalidate: 300 } }
      )
      if (!res.ok) return null
      return res.json() as Promise<HNStory>
    })

    const stories = await Promise.all(storyPromises)

    // Filter for AI/tech keywords and format
    const aiKeywords = ['ai', 'gpt', 'llm', 'openai', 'anthropic', 'claude', 'machine learning',
                        'neural', 'deep learning', 'artificial intelligence', 'chatbot', 'robot',
                        'automation', 'tech', 'startup', 'saas', 'data', 'marketing', 'google',
                        'meta', 'apple', 'microsoft', 'amazon']

    const filteredStories = stories
      .filter((story): story is HNStory => {
        if (!story || !story.title || !story.url) return false
        const titleLower = story.title.toLowerCase()
        return aiKeywords.some(keyword => titleLower.includes(keyword))
      })
      .slice(0, 6) // Take top 6 relevant stories

    // If not enough AI stories, just take the top general stories
    if (filteredStories.length < 3) {
      const topStories = stories
        .filter((story): story is HNStory => !!story && !!story.title && !!story.url)
        .slice(0, 6)

      const newsItems: NewsItem[] = topStories.map((story) => ({
        id: story.id.toString(),
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        date: formatDate(story.time),
        source: new URL(story.url || `https://news.ycombinator.com`).hostname.replace('www.', ''),
      }))

      return NextResponse.json({ news: newsItems })
    }

    const newsItems: NewsItem[] = filteredStories.map((story) => ({
      id: story.id.toString(),
      title: story.title,
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      date: formatDate(story.time),
      source: new URL(story.url || `https://news.ycombinator.com`).hostname.replace('www.', ''),
    }))

    return NextResponse.json({ news: newsItems })
  } catch (error) {
    console.error('News fetch error:', error)

    // Return fallback news on error
    return NextResponse.json({
      news: [],
      error: 'Could not fetch news'
    })
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return date.toLocaleDateString('nl-NL', options)
}
