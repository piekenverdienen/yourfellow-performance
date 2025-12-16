import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// Dutch stopwords for keyword extraction
const DUTCH_STOPWORDS = new Set([
  'de', 'het', 'een', 'van', 'en', 'in', 'op', 'te', 'voor', 'met', 'is', 'dat',
  'die', 'aan', 'zijn', 'er', 'om', 'dan', 'ook', 'als', 'maar', 'bij', 'nog',
  'naar', 'uit', 'wel', 'door', 'over', 'tot', 'je', 'ze', 'we', 'hij', 'zij',
  'wat', 'zo', 'kan', 'niet', 'meer', 'worden', 'wordt', 'werd', 'hebben', 'heeft',
  'deze', 'dit', 'daar', 'hier', 'waar', 'hoe', 'wie', 'welke', 'alle', 'veel',
  'moet', 'kunnen', 'zal', 'zou', 'gaan', 'komen', 'maken', 'doen', 'zien',
  'onze', 'ons', 'jouw', 'uw', 'hun', 'mijn', 'geen', 'alleen', 'onder', 'tussen',
  'zonder', 'tegen', 'tijdens', 'binnen', 'buiten', 'echter', 'omdat', 'wanneer',
  'www', 'http', 'https', 'com', 'html', 'php', 'aspx', 'the', 'and', 'for', 'you',
])

export interface LandingPageContent {
  title: string
  metaDescription: string
  headers: string[]
  mainContent: string
  extractedKeywords: string[]
  ogImage?: string
}

interface FetchUrlRequest {
  url: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Niet ingelogd' },
        { status: 401 }
      )
    }

    const body: FetchUrlRequest = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is vereist' },
        { status: 400 }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json(
        { error: 'Ongeldige URL. Gebruik een volledige URL (https://...)' },
        { status: 400 }
      )
    }

    // Fetch the URL with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response: Response
    try {
      response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YourFellow/1.0; +https://yourfellow.nl)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl,en;q=0.9',
        },
      })
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'De pagina reageert niet (timeout). Probeer het later opnieuw.' },
          { status: 408 }
        )
      }
      return NextResponse.json(
        { error: 'Kan de pagina niet bereiken. Controleer de URL.' },
        { status: 502 }
      )
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Pagina gaf een fout: ${response.status} ${response.statusText}` },
        { status: 502 }
      )
    }

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json(
        { error: 'De URL is geen HTML pagina' },
        { status: 400 }
      )
    }

    // Get HTML content (limit to 500KB)
    const html = await response.text()
    const limitedHtml = html.slice(0, 500000)

    // Parse the HTML
    const content = parseHTML(limitedHtml)

    // Track usage (fire and forget)
    trackUsage(user.id)

    return NextResponse.json({
      success: true,
      url: parsedUrl.toString(),
      content,
    })

  } catch (error) {
    console.error('Fetch URL error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van de pagina' },
      { status: 500 }
    )
  }
}

function parseHTML(html: string): LandingPageContent {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : ''

  // Extract meta description (try multiple formats)
  const metaDescMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
  ) || html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i
  )
  const metaDescription = metaDescMatch ? decodeHTMLEntities(metaDescMatch[1].trim()) : ''

  // Extract OG image
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  )
  const ogImage = ogImageMatch ? ogImageMatch[1].trim() : undefined

  // Extract headers (h1, h2)
  const headerMatches = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
  const headers = headerMatches
    .map(m => stripTags(decodeHTMLEntities(m[1])).trim())
    .filter(h => h.length > 0 && h.length < 200)
    .slice(0, 10) // Max 10 headers

  // Extract main text content
  const mainContent = extractMainContent(html)

  // Extract keywords from all content
  const allText = [title, metaDescription, ...headers, mainContent].join(' ')
  const extractedKeywords = extractKeywords(allText)

  return {
    title,
    metaDescription,
    headers,
    mainContent,
    extractedKeywords,
    ogImage,
  }
}

function extractMainContent(html: string): string {
  // Remove script, style, nav, footer, header elements
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to find main content area
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    || cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || cleaned.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)

  if (mainMatch) {
    cleaned = mainMatch[1]
  }

  // Strip remaining tags and normalize whitespace
  const text = stripTags(decodeHTMLEntities(cleaned))
    .replace(/\s+/g, ' ')
    .trim()

  // Return truncated content
  return text.slice(0, 3000)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function extractKeywords(text: string): string[] {
  // Tokenize and clean
  const words = text
    .toLowerCase()
    .replace(/[^\w\sàáâãäåèéêëìíîïòóôõöùúûüýÿñç-]/g, ' ')
    .split(/\s+/)
    .filter(word =>
      word.length >= 3 &&
      word.length <= 30 &&
      !DUTCH_STOPWORDS.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    )

  // Count frequency
  const frequency: Record<string, number> = {}
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1
  }

  // Return top keywords (minimum 2 occurrences, sorted by frequency)
  return Object.entries(frequency)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word)
}

async function trackUsage(userId: string) {
  try {
    const supabase = await createClient()

    // Insert usage record
    await supabase.from('usage').insert({
      user_id: userId,
      tool: 'fetch-url',
      total_tokens: 0,
    })

    // Add XP (3 XP per URL analysis)
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', userId)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + 3
      const newLevel = Math.floor(newXp / 100) + 1

      await supabase
        .from('profiles')
        .update({ xp: newXp, level: newLevel })
        .eq('id', userId)
    }
  } catch (error) {
    console.error('Error tracking usage:', error)
  }
}
