import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface AnalyticsData {
  provider: string
  campaigns: Array<{
    id: string
    name: string
    status: string
    impressions: number
    clicks: number
    cost: number
    conversions: number
    ctr: number
    cpc: number
  }>
  totals: {
    impressions: number
    clicks: number
    cost: number
    conversions: number
  }
  date_range: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question } = await request.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Get user's integrations
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, provider, account_name, connection_status')
      .eq('user_id', user.id)
      .eq('connection_status', 'connected')

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({
        answer: 'Je hebt nog geen actieve koppelingen. Ga naar Instellingen → Koppelingen om Google Ads of andere platforms te verbinden.',
        has_data: false,
      })
    }

    // Get cached analytics data for all integrations
    const analyticsData: AnalyticsData[] = []

    for (const integration of integrations) {
      const { data: cache } = await supabase
        .from('analytics_cache')
        .select('data')
        .eq('integration_id', integration.id)
        .eq('data_type', 'campaigns')
        .order('cached_at', { ascending: false })
        .limit(1)
        .single()

      if (cache?.data) {
        analyticsData.push({
          provider: integration.provider,
          ...cache.data,
        })
      }
    }

    if (analyticsData.length === 0) {
      return NextResponse.json({
        answer: 'Er is nog geen data beschikbaar. Ga naar Instellingen → Koppelingen en klik op "Sync" om de nieuwste data op te halen.',
        has_data: false,
      })
    }

    // Build context for Claude
    const dataContext = analyticsData.map(data => {
      const providerName = data.provider === 'google_ads' ? 'Google Ads' : 'Meta Ads'
      return `
## ${providerName} Data (${data.date_range || 'Laatste 30 dagen'})

### Totalen
- Impressies: ${data.totals.impressions.toLocaleString('nl-NL')}
- Klikken: ${data.totals.clicks.toLocaleString('nl-NL')}
- Kosten: €${data.totals.cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
- Conversies: ${data.totals.conversions.toLocaleString('nl-NL')}
- Gemiddelde CTR: ${((data.totals.clicks / data.totals.impressions) * 100).toFixed(2)}%
- Gemiddelde CPC: €${(data.totals.cost / data.totals.clicks).toFixed(2)}

### Campagnes
${data.campaigns.map(c => `
- **${c.name}** (${c.status})
  - Impressies: ${c.impressions.toLocaleString('nl-NL')}
  - Klikken: ${c.clicks.toLocaleString('nl-NL')}
  - Kosten: €${c.cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
  - Conversies: ${c.conversions}
  - CTR: ${c.ctr.toFixed(2)}%
  - CPC: €${c.cpc.toFixed(2)}
`).join('')}
`
    }).join('\n---\n')

    // Use Claude to answer the question
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
      system: `Je bent een marketing analytics assistent voor een Nederlands marketing bureau.
Je hebt toegang tot de volgende advertentiedata:

${dataContext}

INSTRUCTIES:
- Beantwoord vragen in het Nederlands
- Gebruik de beschikbare data om specifieke antwoorden te geven
- Geef concrete cijfers en percentages
- Als iets niet in de data staat, zeg dat eerlijk
- Geef praktische aanbevelingen waar relevant
- Houd antwoorden bondig maar informatief
- Gebruik bullet points voor opsommingen
- Vergelijk campagnes wanneer gevraagd
- Bereken metrics als die niet direct beschikbaar zijn (bijv. ROAS als je kosten en conversiewaarde hebt)`,
    })

    const answer = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Kon geen antwoord genereren.'

    // Track usage
    await supabase.from('usage').insert({
      user_id: user.id,
      tool: 'analytics-query',
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      metadata: {
        question,
        providers: analyticsData.map(d => d.provider),
      },
    })

    return NextResponse.json({
      answer,
      has_data: true,
      providers: analyticsData.map(d => d.provider),
    })
  } catch (error) {
    console.error('Analytics query error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis bij het analyseren. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}
