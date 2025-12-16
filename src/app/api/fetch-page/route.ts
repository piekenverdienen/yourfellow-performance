import { NextRequest, NextResponse } from 'next/server'
import Firecrawl from '@mendable/firecrawl-js'
import { createClient } from '@/lib/supabase/server'

interface PageData {
  url: string
  title: string
  description: string
  markdown: string
  html?: string
  metadata: {
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    language?: string
  }
  extractedElements: {
    headings: { level: number; text: string }[]
    ctas: string[]
    testimonials: string[]
    trustSignals: string[]
    forms: { fields: number; hasEmail: boolean; hasPhone: boolean }[]
    prices: string[]
    urgencyElements: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY is not set')
      return NextResponse.json(
        { error: 'Firecrawl API key niet geconfigureerd. Voeg FIRECRAWL_API_KEY toe aan je environment variables.' },
        { status: 500 }
      )
    }

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Je moet ingelogd zijn om paginas op te halen.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url } = body

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { error: 'URL is verplicht' },
        { status: 400 }
      )
    }

    // Basic URL validation
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
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

    // Scrape the page
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
    })

    if (!scrapeResult) {
      return NextResponse.json(
        { error: 'Kon pagina niet ophalen: Geen response van Firecrawl' },
        { status: 400 }
      )
    }

    // Extract relevant elements from the content
    const extractedElements = extractPageElements(
      scrapeResult.markdown || '',
      scrapeResult.html || ''
    )

    const pageData: PageData = {
      url: scrapeResult.metadata?.sourceURL || url,
      title: scrapeResult.metadata?.title || '',
      description: scrapeResult.metadata?.description || '',
      markdown: scrapeResult.markdown || '',
      metadata: {
        ogTitle: scrapeResult.metadata?.ogTitle,
        ogDescription: scrapeResult.metadata?.ogDescription,
        ogImage: scrapeResult.metadata?.ogImage,
        language: scrapeResult.metadata?.language,
      },
      extractedElements,
    }

    return NextResponse.json({
      success: true,
      data: pageData,
    })

  } catch (error) {
    console.error('Fetch page error:', error)

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit bereikt. Wacht even en probeer opnieuw.' },
          { status: 429 }
        )
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'De pagina laadde te langzaam. Probeer het opnieuw.' },
          { status: 408 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het ophalen van de pagina. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}

// Extract CRO-relevant elements from page content
function extractPageElements(markdown: string, html: string) {
  const elements = {
    headings: [] as { level: number; text: string }[],
    ctas: [] as string[],
    testimonials: [] as string[],
    trustSignals: [] as string[],
    forms: [] as { fields: number; hasEmail: boolean; hasPhone: boolean }[],
    prices: [] as string[],
    urgencyElements: [] as string[],
  }

  // Extract headings from markdown
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    elements.headings.push({
      level: match[1].length,
      text: match[2].trim(),
    })
  }

  // Extract CTAs (buttons and links with action words)
  const ctaPatterns = [
    /\[([^\]]*(?:koop|bestel|start|probeer|download|aanmelden|registreer|ontdek|bekijk|lees meer|meer info|contact|offerte|demo|gratis)[^\]]*)\]/gi,
    /\[([^\]]*(?:buy|order|start|try|download|sign up|register|discover|view|learn more|contact|quote|demo|free)[^\]]*)\]/gi,
  ]

  ctaPatterns.forEach(pattern => {
    while ((match = pattern.exec(markdown)) !== null) {
      const cta = match[1].trim()
      if (cta && !elements.ctas.includes(cta)) {
        elements.ctas.push(cta)
      }
    }
  })

  // Also check HTML for buttons
  const buttonRegex = /<button[^>]*>([^<]+)<\/button>/gi
  while ((match = buttonRegex.exec(html)) !== null) {
    const buttonText = match[1].trim()
    if (buttonText && buttonText.length < 50 && !elements.ctas.includes(buttonText)) {
      elements.ctas.push(buttonText)
    }
  }

  // Extract testimonials/reviews patterns
  const testimonialPatterns = [
    /"([^"]{20,200})"\s*[-–—]\s*([^,\n]+)/g,  // "Quote" - Name
    /['"]([^'"]{20,200})['"]\s*[-–—]\s*([^,\n]+)/g,
  ]

  testimonialPatterns.forEach(pattern => {
    while ((match = pattern.exec(markdown)) !== null) {
      const testimonial = `"${match[1].trim()}" - ${match[2].trim()}`
      if (!elements.testimonials.includes(testimonial)) {
        elements.testimonials.push(testimonial)
      }
    }
  })

  // Extract trust signals
  const trustPatterns = [
    /(\d+[+]?\s*(?:klanten|customers|gebruikers|users|bedrijven|companies|reviews?|sterren|stars))/gi,
    /(bekroond|award|certified|gecertificeerd|iso\s*\d+|keurmerk|trusted|betrouwbaar)/gi,
    /(sinds\s*\d{4}|established|opgericht)/gi,
    /(\d+\s*(?:jaar|years?)\s*(?:ervaring|experience))/gi,
    /(geld[\s-]*terug[\s-]*garantie|money[\s-]*back|garantie|guarantee|gratis\s*retour|free\s*return)/gi,
  ]

  trustPatterns.forEach(pattern => {
    while ((match = pattern.exec(markdown)) !== null) {
      const signal = match[1].trim()
      if (signal && !elements.trustSignals.includes(signal)) {
        elements.trustSignals.push(signal)
      }
    }
  })

  // Extract prices
  const priceRegex = /[€$£]\s*\d+(?:[.,]\d{2})?(?:\s*(?:per|\/)\s*(?:maand|month|jaar|year|week))?/gi
  while ((match = priceRegex.exec(markdown)) !== null) {
    const price = match[0].trim()
    if (!elements.prices.includes(price)) {
      elements.prices.push(price)
    }
  }

  // Extract urgency elements
  const urgencyPatterns = [
    /(nog\s*\d+\s*(?:beschikbaar|over|left))/gi,
    /(laatste\s*\d+|only\s*\d+\s*left)/gi,
    /(beperkte?\s*(?:tijd|aanbod|voorraad)|limited\s*(?:time|offer|stock))/gi,
    /(vandaag|today|nu|now|direct|immediately)\s*(?:bestellen|order|kopen|buy)/gi,
    /(aanbieding|sale|korting|discount|actie)\s*(?:tot|until|ends)/gi,
    /(\d+%\s*(?:korting|off|discount))/gi,
  ]

  urgencyPatterns.forEach(pattern => {
    while ((match = pattern.exec(markdown)) !== null) {
      const urgency = match[1].trim()
      if (urgency && !elements.urgencyElements.includes(urgency)) {
        elements.urgencyElements.push(urgency)
      }
    }
  })

  // Detect forms in HTML
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi
  while ((match = formRegex.exec(html)) !== null) {
    const formHtml = match[1]
    const inputCount = (formHtml.match(/<input/gi) || []).length
    const hasEmail = /type=["']?email/i.test(formHtml) || /name=["']?email/i.test(formHtml)
    const hasPhone = /type=["']?tel/i.test(formHtml) || /name=["']?(phone|tel|telefoon)/i.test(formHtml)

    if (inputCount > 0) {
      elements.forms.push({
        fields: inputCount,
        hasEmail,
        hasPhone,
      })
    }
  }

  return elements
}
