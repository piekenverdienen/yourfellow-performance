/**
 * Intake Scraper Service
 *
 * Handles website scraping for intake jobs.
 * Deterministic pipeline: Website → Competitors → Social (best-effort)
 */

import Firecrawl from '@mendable/firecrawl-js'
import type { ScrapedSource, ScrapedStructuredContent, PageType, IntakeJobConfig } from '@/lib/context/types'

// ============================================
// TYPES
// ============================================

interface ScrapeResult {
  success: boolean
  sources: Omit<ScrapedSource, 'id' | 'client_id' | 'intake_job_id' | 'created_at'>[]
  error?: string
}

interface FirecrawlResult {
  markdown?: string
  html?: string
  metadata?: {
    title?: string
    description?: string
    sourceURL?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    language?: string
  }
}

// ============================================
// CONFIGURATION
// ============================================

const EXCLUDE_PATTERNS = [
  'privacy', 'cookie', 'terms', 'voorwaarden', 'disclaimer',
  'login', 'logout', 'register', 'account', 'cart', 'checkout',
  'winkelwagen', 'afrekenen', 'wachtwoord', 'password',
  'wp-content', 'wp-admin', 'wp-json', 'feed', 'rss',
  '.pdf', '.jpg', '.png', '.gif', '.svg', '.webp',
  'mailto:', 'tel:', '#', 'javascript:',
]

const PRIORITY_KEYWORDS = [
  'about', 'over-ons', 'over', 'wie',
  'diensten', 'services', 'aanbod', 'werkwijze',
  'producten', 'products', 'oplossingen', 'solutions',
  'contact', 'team', 'medewerkers',
  'missie', 'visie', 'waarden', 'waarom', 'why',
  'portfolio', 'cases', 'projecten', 'referenties',
  'klanten', 'customers', 'partners',
  'pricing', 'prijzen', 'tarieven',
]

// ============================================
// HELPER FUNCTIONS
// ============================================

function detectPageType(url: string, title?: string): PageType {
  const lowerUrl = url.toLowerCase()
  const lowerTitle = (title || '').toLowerCase()
  const combined = `${lowerUrl} ${lowerTitle}`

  if (combined.includes('about') || combined.includes('over-ons') || combined.includes('wie-zijn')) {
    return 'about'
  }
  if (combined.includes('contact')) {
    return 'contact'
  }
  if (combined.includes('product') || combined.includes('shop')) {
    return 'product'
  }
  if (combined.includes('service') || combined.includes('dienst')) {
    return 'service'
  }
  if (combined.includes('blog') || combined.includes('nieuws') || combined.includes('news')) {
    return 'blog'
  }
  if (combined.includes('pricing') || combined.includes('prijs') || combined.includes('tarief')) {
    return 'pricing'
  }
  if (combined.includes('team') || combined.includes('medewerkers')) {
    return 'team'
  }
  if (combined.includes('career') || combined.includes('vacature') || combined.includes('werken-bij')) {
    return 'careers'
  }
  if (combined.includes('faq') || combined.includes('veelgestelde')) {
    return 'faq'
  }

  // Check if it's the homepage
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname === '/' || urlObj.pathname === '') {
      return 'homepage'
    }
  } catch {
    // Ignore URL parsing errors
  }

  return 'other'
}

function extractStructuredContent(markdown: string, html?: string): ScrapedStructuredContent {
  const content: ScrapedStructuredContent = {}

  // Extract headings
  const headings: string[] = []
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push(match[2].trim())
  }
  if (headings.length > 0) {
    content.headings = headings
  }

  // Extract main content (first 2000 chars of markdown without headings)
  const mainText = markdown
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 2000)
  if (mainText) {
    content.mainContent = mainText
  }

  // Extract links
  const links: string[] = []
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  while ((match = linkRegex.exec(markdown)) !== null) {
    const url = match[2]
    if (url.startsWith('http') && !links.includes(url)) {
      links.push(url)
    }
  }
  if (links.length > 0) {
    content.links = links.slice(0, 50) // Limit to 50 links
  }

  // Extract images from HTML
  if (html) {
    const images: { src: string; alt?: string }[] = []
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1] && images.length < 20) {
        images.push({ src: match[1], alt: match[2] })
      }
    }
    if (images.length > 0) {
      content.images = images
    }
  }

  // Extract metadata hints from content
  const metadataHints: Record<string, string> = {}

  // Look for email addresses
  const emailMatch = markdown.match(/[\w.-]+@[\w.-]+\.\w{2,}/i)
  if (emailMatch) {
    metadataHints.email = emailMatch[0]
  }

  // Look for phone numbers (Dutch format)
  const phoneMatch = markdown.match(/(?:\+31|0)[\s.-]?(?:\d[\s.-]?){9}/i)
  if (phoneMatch) {
    metadataHints.phone = phoneMatch[0]
  }

  if (Object.keys(metadataHints).length > 0) {
    content.metadata = metadataHints
  }

  return content
}

function extractInternalLinks(markdown: string, html: string | undefined, baseUrl: URL): string[] {
  const links: string[] = []

  // Extract from markdown
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = markdownLinkRegex.exec(markdown)) !== null) {
    links.push(match[2])
  }

  // Extract from HTML
  if (html) {
    const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["']/gi
    while ((match = htmlLinkRegex.exec(html)) !== null) {
      links.push(match[1])
    }
  }

  // Filter to internal links only
  return links
    .filter((link) => {
      try {
        const linkUrl = new URL(link, baseUrl.origin)
        return linkUrl.hostname === baseUrl.hostname
      } catch {
        return false
      }
    })
    .filter((link) => {
      const lowerLink = link.toLowerCase()
      return !EXCLUDE_PATTERNS.some((pattern) => lowerLink.includes(pattern))
    })
    .map((link) => {
      try {
        return new URL(link, baseUrl.origin).href
      } catch {
        return link
      }
    })
    .filter((link, index, self) => self.indexOf(link) === index) // Remove duplicates
}

function prioritizeLinks(links: string[]): string[] {
  const priorityLinks = links.filter((link) => {
    const lowerLink = link.toLowerCase()
    return PRIORITY_KEYWORDS.some((keyword) => lowerLink.includes(keyword))
  })

  const otherLinks = links.filter((link) => {
    const lowerLink = link.toLowerCase()
    return !PRIORITY_KEYWORDS.some((keyword) => lowerLink.includes(keyword))
  })

  return [...priorityLinks, ...otherLinks]
}

// ============================================
// MAIN SCRAPING FUNCTIONS
// ============================================

/**
 * Scrape a single URL using Firecrawl
 */
async function scrapeUrl(
  firecrawl: Firecrawl,
  url: string
): Promise<{ success: boolean; result?: FirecrawlResult; error?: string }> {
  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
    })

    if (!result || !result.markdown) {
      return { success: false, error: 'No content returned' }
    }

    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Scrape website pages (main + internal links)
 */
export async function scrapeWebsite(
  websiteUrl: string,
  maxPages: number = 5
): Promise<ScrapeResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, sources: [], error: 'FIRECRAWL_API_KEY not configured' }
  }

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const sources: ScrapeResult['sources'] = []

  // Validate URL
  let baseUrl: URL
  try {
    baseUrl = new URL(websiteUrl)
    if (!['http:', 'https:'].includes(baseUrl.protocol)) {
      return { success: false, sources: [], error: 'Invalid URL protocol' }
    }
  } catch {
    return { success: false, sources: [], error: 'Invalid URL' }
  }

  // Scrape main page
  const mainResult = await scrapeUrl(firecrawl, websiteUrl)

  if (!mainResult.success || !mainResult.result) {
    return { success: false, sources: [], error: mainResult.error || 'Failed to scrape main page' }
  }

  // Add main page to sources
  sources.push({
    source_type: 'website',
    url: websiteUrl,
    title: mainResult.result.metadata?.title || null,
    raw_content: mainResult.result.markdown || null,
    structured_content: extractStructuredContent(
      mainResult.result.markdown || '',
      mainResult.result.html
    ),
    extracted_at: new Date().toISOString(),
    extraction_method: 'firecrawl',
    extraction_success: true,
    extraction_error: null,
    page_type: detectPageType(websiteUrl, mainResult.result.metadata?.title),
    depth: 0,
    is_competitor: false,
    competitor_name: null,
  })

  // Extract and prioritize internal links
  const allLinks = extractInternalLinks(
    mainResult.result.markdown || '',
    mainResult.result.html,
    baseUrl
  )
  const prioritizedLinks = prioritizeLinks(allLinks).slice(0, maxPages - 1)

  // Scrape additional pages in parallel (with concurrency limit)
  const CONCURRENCY = 3
  for (let i = 0; i < prioritizedLinks.length; i += CONCURRENCY) {
    const batch = prioritizedLinks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((link) => scrapeUrl(firecrawl, link))
    )

    results.forEach((result, idx) => {
      const link = batch[idx]
      if (result.status === 'fulfilled' && result.value.success && result.value.result) {
        sources.push({
          source_type: 'website',
          url: link,
          title: result.value.result.metadata?.title || null,
          raw_content: result.value.result.markdown || null,
          structured_content: extractStructuredContent(
            result.value.result.markdown || '',
            result.value.result.html
          ),
          extracted_at: new Date().toISOString(),
          extraction_method: 'firecrawl',
          extraction_success: true,
          extraction_error: null,
          page_type: detectPageType(link, result.value.result.metadata?.title),
          depth: 1,
          is_competitor: false,
          competitor_name: null,
        })
      } else {
        sources.push({
          source_type: 'website',
          url: link,
          title: null,
          raw_content: null,
          structured_content: null,
          extracted_at: new Date().toISOString(),
          extraction_method: 'firecrawl',
          extraction_success: false,
          extraction_error:
            result.status === 'rejected'
              ? String(result.reason)
              : (result.value as { error?: string }).error || 'Unknown error',
          page_type: null,
          depth: 1,
          is_competitor: false,
          competitor_name: null,
        })
      }
    })
  }

  return { success: true, sources }
}

/**
 * Scrape competitor websites
 */
export async function scrapeCompetitors(
  competitorUrls: string[],
  maxPagesPerCompetitor: number = 3
): Promise<ScrapeResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, sources: [], error: 'FIRECRAWL_API_KEY not configured' }
  }

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const sources: ScrapeResult['sources'] = []

  // Scrape each competitor (max 3 concurrent)
  const CONCURRENCY = 3
  for (let i = 0; i < competitorUrls.length; i += CONCURRENCY) {
    const batch = competitorUrls.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const baseUrl = new URL(url)
        const competitorName = baseUrl.hostname.replace('www.', '')

        // Scrape main page
        const mainResult = await scrapeUrl(firecrawl, url)

        if (!mainResult.success || !mainResult.result) {
          return {
            url,
            competitorName,
            sources: [
              {
                source_type: 'competitor' as const,
                url,
                title: null,
                raw_content: null,
                structured_content: null,
                extracted_at: new Date().toISOString(),
                extraction_method: 'firecrawl' as const,
                extraction_success: false,
                extraction_error: mainResult.error || null,
                page_type: null,
                depth: 0,
                is_competitor: true,
                competitor_name: competitorName,
              },
            ],
          }
        }

        const competitorSources: ScrapeResult['sources'] = [
          {
            source_type: 'competitor',
            url,
            title: mainResult.result.metadata?.title || null,
            raw_content: mainResult.result.markdown || null,
            structured_content: extractStructuredContent(
              mainResult.result.markdown || '',
              mainResult.result.html
            ),
            extracted_at: new Date().toISOString(),
            extraction_method: 'firecrawl',
            extraction_success: true,
            extraction_error: null,
            page_type: 'homepage',
            depth: 0,
            is_competitor: true,
            competitor_name: competitorName,
          },
        ]

        // Get additional pages if allowed
        if (maxPagesPerCompetitor > 1) {
          const links = extractInternalLinks(
            mainResult.result.markdown || '',
            mainResult.result.html,
            baseUrl
          )
          const prioritized = prioritizeLinks(links).slice(0, maxPagesPerCompetitor - 1)

          for (const link of prioritized) {
            const pageResult = await scrapeUrl(firecrawl, link)
            if (pageResult.success && pageResult.result) {
              competitorSources.push({
                source_type: 'competitor',
                url: link,
                title: pageResult.result.metadata?.title || null,
                raw_content: pageResult.result.markdown || null,
                structured_content: extractStructuredContent(
                  pageResult.result.markdown || '',
                  pageResult.result.html
                ),
                extracted_at: new Date().toISOString(),
                extraction_method: 'firecrawl',
                extraction_success: true,
                extraction_error: null,
                page_type: detectPageType(link, pageResult.result.metadata?.title),
                depth: 1,
                is_competitor: true,
                competitor_name: competitorName,
              })
            }
          }
        }

        return { url, competitorName, sources: competitorSources }
      })
    )

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        sources.push(...result.value.sources)
      }
    })
  }

  return { success: true, sources }
}

/**
 * Scrape social media profiles (best-effort)
 */
export async function scrapeSocialProfiles(
  socialUrls: IntakeJobConfig['social_urls']
): Promise<ScrapeResult> {
  if (!socialUrls) {
    return { success: true, sources: [] }
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, sources: [], error: 'FIRECRAWL_API_KEY not configured' }
  }

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const sources: ScrapeResult['sources'] = []

  const profiles = [
    { type: 'social_linkedin' as const, url: socialUrls.linkedin },
    { type: 'social_instagram' as const, url: socialUrls.instagram },
    { type: 'social_facebook' as const, url: socialUrls.facebook },
    { type: 'social_twitter' as const, url: socialUrls.twitter },
    { type: 'social_youtube' as const, url: socialUrls.youtube },
  ].filter((p) => p.url)

  // Best-effort: don't fail if social scraping fails
  const results = await Promise.allSettled(
    profiles.map(async ({ type, url }) => {
      if (!url) return null

      const result = await scrapeUrl(firecrawl, url)
      return {
        source_type: type,
        url,
        title: result.success ? result.result?.metadata?.title || null : null,
        raw_content: result.success ? result.result?.markdown || null : null,
        structured_content: result.success
          ? extractStructuredContent(result.result?.markdown || '', result.result?.html)
          : null,
        extracted_at: new Date().toISOString(),
        extraction_method: 'firecrawl' as const,
        extraction_success: result.success,
        extraction_error: result.success ? null : result.error || null,
        page_type: null as PageType | null,
        depth: 0,
        is_competitor: false,
        competitor_name: null,
      }
    })
  )

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      sources.push(result.value)
    }
  })

  return { success: true, sources }
}

/**
 * Run complete scraping pipeline for an intake job
 */
export async function runScrapingPipeline(config: IntakeJobConfig): Promise<{
  success: boolean
  sources: ScrapeResult['sources']
  errors: string[]
}> {
  const sources: ScrapeResult['sources'] = []
  const errors: string[] = []

  // 1. Scrape website (required)
  if (config.website_url && !config.skip_scraping) {
    const websiteResult = await scrapeWebsite(config.website_url, config.max_pages ?? 5)
    if (websiteResult.success) {
      sources.push(...websiteResult.sources)
    } else {
      errors.push(`Website scraping failed: ${websiteResult.error}`)
      // Website scraping is required - fail if it fails
      return { success: false, sources, errors }
    }
  }

  // 2. Scrape competitors (optional)
  if (config.competitor_urls && config.competitor_urls.length > 0 && !config.skip_scraping) {
    const competitorResult = await scrapeCompetitors(
      config.competitor_urls.slice(0, 3), // Max 3 competitors
      config.max_competitor_pages ?? 3
    )
    if (competitorResult.success) {
      sources.push(...competitorResult.sources)
    } else {
      errors.push(`Competitor scraping failed: ${competitorResult.error}`)
      // Don't fail the whole job for competitor errors
    }
  }

  // 3. Scrape social (best-effort)
  if (config.social_urls && !config.skip_scraping) {
    const socialResult = await scrapeSocialProfiles(config.social_urls)
    if (socialResult.success) {
      sources.push(...socialResult.sources)
    } else {
      errors.push(`Social scraping failed: ${socialResult.error}`)
      // Don't fail for social errors
    }
  }

  return { success: true, sources, errors }
}
