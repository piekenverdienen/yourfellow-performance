import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzePageContent } from '@/seo/page-analyzer'
import { SearchConsoleClient } from '@/seo/search-console'
import { analyzeKeywords, getHighSignalKeywords } from '@/seo/keyword-analyzer'
import { SEOAdvisor, buildContentAdvisoryReport } from '@/seo/advisor'
import type { ContentAdvisoryReport, SearchConsoleQuery, PageContent } from '@/seo/types'

// Extended query with mentions count
interface QueryWithMentions extends SearchConsoleQuery {
  mentions: number
  inTitle: boolean
  inH1: boolean
  inH2: boolean
  isQuestion: boolean
}

// Count mentions of a query in page content
function countMentions(query: string, content: PageContent): {
  mentions: number
  inTitle: boolean
  inH1: boolean
  inH2: boolean
} {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  // Check full query match
  const allText = [
    content.title,
    content.metaDescription,
    ...content.h1,
    ...content.h2,
    content.mainText,
  ].join(' ').toLowerCase()

  // Count exact matches
  const exactMatches = (allText.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length

  // If no exact match, count partial word matches
  let mentions = exactMatches
  if (mentions === 0 && queryWords.length > 1) {
    // Count how many query words appear
    const wordMatches = queryWords.filter(word => allText.includes(word)).length
    if (wordMatches >= queryWords.length * 0.5) {
      mentions = 1 // Partial match
    }
  }

  const titleLower = content.title.toLowerCase()
  const h1Lower = content.h1.join(' ').toLowerCase()
  const h2Lower = content.h2.join(' ').toLowerCase()

  return {
    mentions,
    inTitle: titleLower.includes(queryLower) || queryWords.some(w => titleLower.includes(w)),
    inH1: h1Lower.includes(queryLower) || queryWords.some(w => h1Lower.includes(w)),
    inH2: h2Lower.includes(queryLower) || queryWords.some(w => h2Lower.includes(w)),
  }
}

// Check if query is a question
function isQuestionQuery(query: string): boolean {
  const questionPatterns = /^(wat|hoe|waarom|wanneer|wie|welke|waar|hoeveel|what|how|why|when|who|which|where|can|is|are|do|does)/i
  return questionPatterns.test(query) || query.includes('?')
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Niet ingelogd' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { pageUrl, siteUrl } = body

    if (!pageUrl || !siteUrl) {
      return NextResponse.json(
        { success: false, error: 'pageUrl en siteUrl zijn verplicht' },
        { status: 400 }
      )
    }

    // Validate URLs
    try {
      new URL(pageUrl)
      if (!siteUrl.startsWith('sc-domain:')) {
        new URL(siteUrl)
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Ongeldige URL' },
        { status: 400 }
      )
    }

    // Step 1: Fetch page content
    console.log(`[SEO] Fetching page content: ${pageUrl}`)
    const pageContent = await analyzePageContent(pageUrl)

    // Step 2: Fetch Search Console data
    console.log(`[SEO] Fetching Search Console data for: ${siteUrl}`)
    const scClient = SearchConsoleClient.fromEnv()
    const searchData = await scClient.getPageData(siteUrl, pageUrl, {
      dateRangeDays: 28,
      rowLimit: 500,
    })

    console.log(`[SEO] Found ${searchData.queries.length} queries`)

    // Step 2.5: Enrich queries with mentions data
    const queriesWithMentions: QueryWithMentions[] = searchData.queries.map((q) => {
      const mentionData = countMentions(q.query, pageContent)
      return {
        ...q,
        ...mentionData,
        isQuestion: isQuestionQuery(q.query),
      }
    })

    // Step 3: Analyze keywords
    console.log(`[SEO] Analyzing keywords...`)
    const keywordAnalysis = analyzeKeywords(pageContent, searchData.queries, {
      minImpressions: 10,
      minPosition: 1,
      maxPosition: 50,
    })

    // Step 4: Generate LLM recommendations
    console.log(`[SEO] Generating AI recommendations...`)
    const highSignalKeywords = getHighSignalKeywords(keywordAnalysis, 20)

    let report: ContentAdvisoryReport

    // Check if we have enough data for meaningful analysis
    if (searchData.queries.length === 0) {
      // Return basic report without LLM
      report = {
        pageUrl,
        generatedAt: new Date(),
        currentState: {
          title: pageContent.title,
          metaDescription: pageContent.metaDescription,
          wordCount: pageContent.wordCount,
          h1Count: pageContent.h1.length,
          h2Count: pageContent.h2.length,
          keyTopics: [],
        },
        keywordAnalysis: {
          totalQueriesAnalyzed: 0,
          highPriorityOpportunities: 0,
          topMissingKeywords: [],
          topRankingKeywords: [],
        },
        suggestions: [],
        faqSuggestions: [],
        overallScore: 50,
        executiveSummary: 'Geen Search Console data gevonden voor deze pagina. Zorg dat de pagina geïndexeerd is en wacht tot er zoekdata beschikbaar is.',
        topPriorities: [
          'Controleer of de pagina geïndexeerd is in Google',
          'Wacht minimaal 2-4 weken na publicatie voor zoekdata',
          'Dien de URL in via Search Console voor snellere indexatie',
        ],
      }
    } else {
      // Full analysis with LLM
      const advisor = new SEOAdvisor({
        maxSuggestions: 8,
      })

      const llmOutput = await advisor.generateAdvice({
        pageContent,
        keywordData: highSignalKeywords,
        analysisContext: {
          pageUrl,
          totalImpressions: searchData.totalImpressions,
          averagePosition: searchData.averagePosition,
          topQueries: searchData.queries.slice(0, 10).map((q) => ({
            query: q.query,
            impressions: q.impressions,
            position: q.position,
          })),
        },
      })

      report = buildContentAdvisoryReport(
        pageContent,
        highSignalKeywords,
        llmOutput,
        {
          totalImpressions: searchData.totalImpressions,
          averagePosition: searchData.averagePosition,
        }
      )
    }

    // Track usage
    await supabase.from('usage').insert({
      user_id: user.id,
      tool: 'seo-advisor',
      total_tokens: 0, // We don't track tokens for this tool
    })

    console.log(`[SEO] Analysis complete for: ${pageUrl}`)

    return NextResponse.json({
      success: true,
      data: report,
      // Include raw data for advanced filtering
      rawData: {
        queries: queriesWithMentions,
        pageContent: {
          title: pageContent.title,
          metaDescription: pageContent.metaDescription,
          h1: pageContent.h1,
          h2: pageContent.h2,
          wordCount: pageContent.wordCount,
        },
        totals: {
          impressions: searchData.totalImpressions,
          clicks: searchData.totalClicks,
          averagePosition: searchData.averagePosition,
        },
      },
    })
  } catch (error) {
    console.error('[SEO] Analysis error:', error)

    const message = error instanceof Error ? error.message : 'Onbekende fout'

    // Provide more helpful error messages
    let userMessage = message
    if (message.includes('403')) {
      userMessage = 'Geen toegang tot Search Console. Zorg dat het service account is toegevoegd aan je property met "Volledige" rechten.'
    } else if (message.includes('404') || message.includes('not found')) {
      userMessage = 'Search Console property niet gevonden. Controleer de URL (bijv. https://jouwsite.nl/ of sc-domain:jouwsite.nl)'
    } else if (message.includes('credentials')) {
      userMessage = 'Search Console credentials niet geconfigureerd. Neem contact op met de beheerder.'
    }

    return NextResponse.json(
      { success: false, error: userMessage },
      { status: 500 }
    )
  }
}
