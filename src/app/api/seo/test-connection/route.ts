import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SearchConsoleClient } from '@/seo/search-console'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Niet ingelogd' }, { status: 401 })
    }

    const body = await request.json()
    const { siteUrl } = body

    if (!siteUrl) {
      return NextResponse.json(
        { success: false, error: 'siteUrl is verplicht' },
        { status: 400 }
      )
    }

    // Initialize Search Console client
    const scClient = SearchConsoleClient.fromEnv()

    // Try to list sites to verify access
    const sites = await scClient.listSites()

    // Check if the requested site is in the list
    const normalizedSiteUrl = siteUrl.startsWith('sc-domain:')
      ? siteUrl
      : siteUrl.endsWith('/')
        ? siteUrl
        : siteUrl + '/'

    const hasAccess = sites.some((site) => {
      const normalizedSite = site.endsWith('/') ? site : site + '/'
      return (
        normalizedSite === normalizedSiteUrl ||
        site === siteUrl ||
        site === normalizedSiteUrl
      )
    })

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: `Geen toegang tot ${siteUrl}. Beschikbare properties: ${sites.join(', ') || '(geen)'}`,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Verbinding succesvol',
      availableSites: sites,
    })
  } catch (error) {
    console.error('[SEO] Test connection error:', error)

    const message = error instanceof Error ? error.message : 'Onbekende fout'

    let userMessage = message
    if (message.includes('credentials')) {
      userMessage = 'Search Console credentials niet geconfigureerd. Neem contact op met de beheerder.'
    } else if (message.includes('403')) {
      userMessage = 'Geen toegang. Controleer of het service account is toegevoegd aan Search Console.'
    }

    return NextResponse.json({ success: false, error: userMessage }, { status: 500 })
  }
}
