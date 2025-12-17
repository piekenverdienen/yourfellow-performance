/**
 * Page Content Analyzer
 *
 * Fetches and extracts SEO-relevant content from web pages:
 * - Title, meta description, canonical URL
 * - H1, H2, H3 headings
 * - Main body text with word count
 * - Open Graph metadata
 * - Structured data (JSON-LD)
 */

import type { PageContent, PageContentExtractionOptions } from '../types'

const DEFAULT_OPTIONS: PageContentExtractionOptions = {
  includeStructuredData: true,
  maxTextLength: 50000,
  timeout: 15000,
}

const USER_AGENT = 'Mozilla/5.0 (compatible; YourFellow-SEO/1.0; +https://yourfellow.nl)'

/**
 * Fetch and analyze a web page for SEO content
 */
export async function analyzePageContent(
  url: string,
  options: PageContentExtractionOptions = {}
): Promise<PageContent> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported')
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  // Fetch the page
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout)

  let html: string
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Expected HTML content, got: ${contentType}`)
    }

    html = await response.text()

    // Limit HTML size
    if (html.length > 2_000_000) {
      html = html.slice(0, 2_000_000)
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${opts.timeout}ms`)
    }
    throw error
  }

  // Extract content
  return extractPageContent(url, html, opts)
}

/**
 * Extract SEO content from HTML
 */
function extractPageContent(
  url: string,
  html: string,
  options: PageContentExtractionOptions
): PageContent {
  // Title
  const title = extractMetaContent(html, /<title[^>]*>([^<]*)<\/title>/i) || ''

  // Meta description
  const metaDescription =
    extractMetaAttribute(html, 'description') ||
    extractMetaAttribute(html, 'og:description') ||
    ''

  // Canonical URL
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  const canonicalUrl = canonicalMatch ? decodeHtmlEntities(canonicalMatch[1]) : undefined

  // Open Graph
  const ogTitle = extractMetaAttribute(html, 'og:title')
  const ogDescription = extractMetaAttribute(html, 'og:description')
  const ogImage = extractMetaAttribute(html, 'og:image')

  // Language
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i)
  const language = langMatch ? langMatch[1] : undefined

  // Headings
  const h1 = extractHeadings(html, 'h1')
  const h2 = extractHeadings(html, 'h2')
  const h3 = extractHeadings(html, 'h3')

  // Main text content
  const mainText = extractMainText(html, options.maxTextLength!)
  const wordCount = countWords(mainText)

  // Structured data (JSON-LD)
  let structuredData: Record<string, unknown>[] | undefined
  if (options.includeStructuredData) {
    structuredData = extractStructuredData(html)
  }

  return {
    url,
    title: decodeHtmlEntities(title).trim(),
    metaDescription: decodeHtmlEntities(metaDescription).trim(),
    canonicalUrl,
    h1: h1.map((h) => decodeHtmlEntities(h).trim()),
    h2: h2.map((h) => decodeHtmlEntities(h).trim()),
    h3: h3.map((h) => decodeHtmlEntities(h).trim()),
    mainText,
    wordCount,
    language,
    ogTitle: ogTitle ? decodeHtmlEntities(ogTitle).trim() : undefined,
    ogDescription: ogDescription ? decodeHtmlEntities(ogDescription).trim() : undefined,
    ogImage,
    structuredData,
    fetchedAt: new Date(),
  }
}

/**
 * Extract meta tag content by name or property
 */
function extractMetaAttribute(html: string, nameOrProperty: string): string | undefined {
  // Try name attribute
  const namePattern = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(nameOrProperty)}["'][^>]+content=["']([^"']*)["']`,
    'i'
  )
  const nameMatch = html.match(namePattern)
  if (nameMatch) return nameMatch[1]

  // Try property attribute (for Open Graph)
  const propertyPattern = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(nameOrProperty)}["'][^>]+content=["']([^"']*)["']`,
    'i'
  )
  const propertyMatch = html.match(propertyPattern)
  if (propertyMatch) return propertyMatch[1]

  // Try reverse order (content before name/property)
  const reverseNamePattern = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapeRegex(nameOrProperty)}["']`,
    'i'
  )
  const reverseNameMatch = html.match(reverseNamePattern)
  if (reverseNameMatch) return reverseNameMatch[1]

  const reversePropertyPattern = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapeRegex(nameOrProperty)}["']`,
    'i'
  )
  const reversePropertyMatch = html.match(reversePropertyPattern)
  if (reversePropertyMatch) return reversePropertyMatch[1]

  return undefined
}

/**
 * Extract content from regex match
 */
function extractMetaContent(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern)
  return match ? match[1] : undefined
}

/**
 * Extract all headings of a specific level
 */
function extractHeadings(html: string, tag: 'h1' | 'h2' | 'h3'): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([^<]*(?:<[^/h][^>]*>[^<]*)*)<\/${tag}>`, 'gi')
  const headings: string[] = []
  let match

  while ((match = pattern.exec(html)) !== null && headings.length < 50) {
    const text = stripTags(match[1]).trim()
    if (text) {
      headings.push(text)
    }
  }

  return headings
}

/**
 * Extract main text content from HTML
 */
function extractMainText(html: string, maxLength: number): string {
  // Remove elements that don't contain main content
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  // Try to find main content area
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

  if (mainMatch) {
    cleaned = mainMatch[1]
  } else if (articleMatch) {
    cleaned = articleMatch[1]
  }

  // Strip remaining HTML tags and normalize whitespace
  let text = stripTags(cleaned)
  text = decodeHtmlEntities(text)
  text = text.replace(/\s+/g, ' ').trim()

  // Truncate if needed
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...'
  }

  return text
}

/**
 * Extract JSON-LD structured data
 */
function extractStructuredData(html: string): Record<string, unknown>[] {
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const results: Record<string, unknown>[] = []
  let match

  while ((match = pattern.exec(html)) !== null && results.length < 10) {
    try {
      const data = JSON.parse(match[1])
      if (Array.isArray(data)) {
        results.push(...data)
      } else {
        results.push(data)
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return results
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  return words.length
}

/**
 * Strip HTML tags from string
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export { extractMainText, countWords, stripTags, decodeHtmlEntities }
