import { NextRequest, NextResponse } from 'next/server'
import Firecrawl from '@mendable/firecrawl-js'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { ClientContext } from '@/types'

interface ScrapedPage {
  url: string
  markdown: string
  title: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check API keys
    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: 'Firecrawl API key niet geconfigureerd' },
        { status: 500 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key niet geconfigureerd' },
        { status: 500 }
      )
    }

    // Verify user is authenticated and has access
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Je moet ingelogd zijn' },
        { status: 401 }
      )
    }

    // Check if user has admin access to this client
    const { data: roleData } = await supabase
      .rpc('get_client_role', { check_client_id: id, check_user_id: user.id })

    if (!roleData || !['admin', 'owner'].includes(roleData)) {
      return NextResponse.json(
        { error: 'Geen toegang om AI context te genereren' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { websiteUrl, maxPages = 5 } = body

    // Validate URL
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is verplicht' },
        { status: 400 }
      )
    }

    try {
      const parsedUrl = new URL(websiteUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json(
        { error: 'Ongeldige URL. Gebruik een volledige URL (bijv. https://example.com)' },
        { status: 400 }
      )
    }

    // Initialize Firecrawl
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })

    // Scrape the main page first
    const mainPageResult = await firecrawl.scrape(websiteUrl, {
      formats: ['markdown'],
    })

    if (!mainPageResult || !mainPageResult.markdown) {
      return NextResponse.json(
        { error: 'Kon website niet scrapen. Controleer de URL en probeer opnieuw.' },
        { status: 400 }
      )
    }

    const scrapedPages: ScrapedPage[] = [{
      url: websiteUrl,
      markdown: mainPageResult.markdown,
      title: mainPageResult.metadata?.title || 'Homepage',
    }]

    // Extract links from markdown content (since 'links' format may not be supported)
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
    const extractedLinks: string[] = []
    let match
    while ((match = linkRegex.exec(mainPageResult.markdown)) !== null) {
      extractedLinks.push(match[2])
    }

    // Extract internal links and scrape additional pages
    const baseUrl = new URL(websiteUrl)

    // Pages to always exclude
    const excludePatterns = [
      'privacy', 'cookie', 'terms', 'voorwaarden', 'disclaimer',
      'login', 'logout', 'register', 'account', 'cart', 'checkout',
      'winkelwagen', 'afrekenen', 'wachtwoord', 'password',
      'wp-content', 'wp-admin', 'wp-json', 'feed', 'rss',
      '.pdf', '.jpg', '.png', '.gif', '.svg', '.webp',
      'mailto:', 'tel:', '#', 'javascript:',
    ]

    // Priority keywords for important pages
    const priorityKeywords = [
      'about', 'over-ons', 'over', 'wie',
      'diensten', 'services', 'aanbod', 'werkwijze',
      'producten', 'products', 'oplossingen', 'solutions',
      'contact', 'team', 'medewerkers',
      'missie', 'visie', 'waarden', 'waarom', 'why',
      'portfolio', 'cases', 'projecten', 'referenties',
      'klanten', 'customers', 'partners',
    ]

    // Filter to internal links only, excluding unwanted pages
    const allInternalLinks = extractedLinks
      .filter((link: string) => {
        try {
          const linkUrl = new URL(link, websiteUrl)
          return linkUrl.hostname === baseUrl.hostname
        } catch {
          return false
        }
      })
      .filter((link: string) => {
        const lowerLink = link.toLowerCase()
        return !excludePatterns.some(pattern => lowerLink.includes(pattern))
      })
      // Remove duplicates
      .filter((link: string, index: number, self: string[]) => self.indexOf(link) === index)

    // First, get priority pages
    const priorityLinks = allInternalLinks.filter((link: string) => {
      const lowerLink = link.toLowerCase()
      return priorityKeywords.some(keyword => lowerLink.includes(keyword))
    })

    // Then, fill with other internal links if needed
    const otherLinks = allInternalLinks.filter((link: string) => {
      const lowerLink = link.toLowerCase()
      return !priorityKeywords.some(keyword => lowerLink.includes(keyword))
    })

    // Combine: priority first, then others, up to maxPages - 1
    const internalLinks = [...priorityLinks, ...otherLinks]
      .slice(0, maxPages - 1)

    // Scrape additional pages in parallel
    const additionalScrapes = await Promise.allSettled(
      internalLinks.map(async (link: string) => {
        const result = await firecrawl.scrape(link, {
          formats: ['markdown'],
        })
        if (result && result.markdown) {
          return {
            url: link,
            markdown: result.markdown,
            title: result.metadata?.title || link,
          }
        }
        return null
      })
    )

    // Add successful scrapes
    additionalScrapes.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        scrapedPages.push(result.value)
      }
    })

    // Prepare content for Claude
    const pagesContent = scrapedPages.map((page, index) => {
      const content = page.markdown
      // Limit content per page to avoid token limits
      const truncatedContent = content.length > 8000
        ? content.substring(0, 8000) + '\n\n[... inhoud afgekapt ...]'
        : content

      return `## ${page.title}\nURL: ${page.url}\n\n${truncatedContent}`
    }).join('\n\n---\n\n')

    // Use Claude to analyze and generate context
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `Je bent een senior marketeer en brand strategist gespecialiseerd in het vertalen van website content naar een consistente AI Context voor marketing automation.

Je taak is om aangeleverde website content (bijv. homepage, productpagina's, over-ons, USP-blokken en CTA's) te analyseren en hieruit een gestructureerde AI Context te genereren.

Analyseer de content en extraheer of genereer de volgende elementen:

1. **Propositie**
   - Wat biedt dit bedrijf concreet?
   - Wat is hun primaire waarde voor de klant?
   (2–3 zinnen)

2. **Doelgroep**
   - Wie is de ideale klant?
   - Denk aan type bedrijf/persoon, situatie, belangrijkste behoeften, pains & gains.
   (2–3 zinnen)

3. **USPs**
   - 3–5 onderscheidende kenmerken die expliciet of impliciet uit de content blijken.
   - Vermijd generieke claims zoals "hoge kwaliteit" tenzij onderbouwd.

4. **Tone of Voice**
   - Hoe klinkt de communicatie?
   - Denk aan stijl, taalgebruik en emotie (bijv. informeel vs formeel, direct vs adviserend).

5. **Brand Voice**
   - Welke kernwaarden straalt het merk uit?
   - Als het merk een persoon was: hoe zou die praten, denken en beslissingen nemen?

6. **Bestsellers / Hero-producten**
   - Producten of diensten die opvallend vaak genoemd of prominent gepositioneerd zijn.
   - Indien niet duidelijk: geef een inschatting of laat leeg.

7. **Seizoensgebonden momenten**
   - Relevante commerciële of inhoudelijke momenten (bijv. feestdagen, seizoenen, piekperiodes).
   - Alleen opnemen als logisch voor de branche of zichtbaar in de content.

Geef de output uitsluitend in het volgende JSON-formaat:

{
  "proposition": "string",
  "targetAudience": "string",
  "usps": ["string", "string"],
  "toneOfVoice": "string",
  "brandVoice": "string",
  "bestsellers": ["string"] of [],
  "seasonality": ["string"] of []
}

Richtlijnen:
- Baseer je primair op expliciete content.
- Als informatie ontbreekt, maak een onderbouwde aanname op basis van branche en positionering.
- Vermijd vage of generieke marketingtaal.
- Schrijf alsof deze context direct gebruikt wordt voor automatische contentgeneratie.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyseer de volgende website content en genereer een AI Context profiel:\n\n${pagesContent}`,
        },
      ],
      system: systemPrompt,
    })

    // Extract JSON from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Try to parse JSON from the response
    let generatedContext: Partial<ClientContext>
    try {
      // Find JSON in the response (might be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      generatedContext = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Failed to parse Claude response:', responseText)
      return NextResponse.json(
        { error: 'Kon de AI response niet verwerken. Probeer opnieuw.' },
        { status: 500 }
      )
    }

    // Ensure required fields have defaults
    const context: ClientContext = {
      proposition: generatedContext.proposition || '',
      targetAudience: generatedContext.targetAudience || '',
      usps: Array.isArray(generatedContext.usps) ? generatedContext.usps : [],
      toneOfVoice: generatedContext.toneOfVoice || '',
      brandVoice: generatedContext.brandVoice || '',
      bestsellers: Array.isArray(generatedContext.bestsellers) ? generatedContext.bestsellers : [],
      seasonality: Array.isArray(generatedContext.seasonality) ? generatedContext.seasonality : [],
      doNots: [],
      mustHaves: [],
      activeChannels: [],
    }

    return NextResponse.json({
      success: true,
      context,
      pagesAnalyzed: scrapedPages.length,
      sourceUrl: websiteUrl,
    })

  } catch (error) {
    console.error('Generate context error:', error)

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit bereikt. Wacht even en probeer opnieuw.' },
          { status: 429 }
        )
      }

      // Return more specific error for debugging
      return NextResponse.json(
        { error: `Fout: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren van de context. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}
