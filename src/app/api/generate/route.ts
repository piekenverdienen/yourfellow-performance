import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Fallback prompts in case database is unavailable
const FALLBACK_PROMPTS: Record<string, { system_prompt: string; xp_reward: number; model: string; max_tokens: number }> = {
  'image-prompt': {
    system_prompt: `Je bent een expert image prompt engineer. Je analyseert social media posts en schrijft visueel beschrijvende prompts voor AI image generators.

PROCES:
1. Lees de social media post ZORGVULDIG
2. Identificeer het KERNTHEMA en de BOODSCHAP
3. Bedenk een visueel concept dat deze boodschap versterkt
4. Schrijf een gedetailleerde image prompt

PLATFORM-SPECIFIEKE STIJLEN:
- LinkedIn: Professioneel, corporate, zakelijk. Kantooromgevingen, vergaderingen, business casual.
- Instagram: Levendig, eye-catching, trendy. Felle kleuren, lifestyle, aspirational.
- Facebook: Warm, vriendelijk, community-gericht. Authentieke momenten, relatable.
- Twitter/X: Bold, impactvol, high contrast. Werkt goed als thumbnail.

OUTPUT REGELS:
- Schrijf ALLEEN de image prompt, geen uitleg
- Prompt moet in het ENGELS zijn
- NOOIT tekst, woorden, letters of logo's beschrijven (AI kan dit niet)
- Beschrijf: onderwerp, setting, belichting, stijl, kleuren, compositie, sfeer
- Gebruik beschrijvende bijvoeglijke naamwoorden
- Max 80 woorden

VOORBEELDEN:
- Post over teamwork → "Diverse professional team collaborating in modern open office, warm natural lighting, plants and glass partitions, candid moment of discussion, corporate lifestyle photography"
- Post over innovatie → "Abstract digital visualization of connected nodes and flowing data streams, deep blue and cyan gradients, futuristic tech aesthetic, clean minimal composition"
- Post over groei → "Upward trending graph made of growing plants and leaves, soft natural lighting, hopeful green tones, metaphorical business growth concept"`,
    xp_reward: 5,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
  },
  'google-ads-copy': {
    system_prompt: `Je bent een ervaren Google Ads copywriter gespecialiseerd in het schrijven van advertenties met hoge Quality Scores.

JOUW DOEL:
Schrijf advertentieteksten die:
1. Direct de aandacht trekken en aanzetten tot klikken
2. Relevant zijn voor de zoekintentie van de gebruiker
3. Consistent zijn met de landingspagina (indien meegegeven)
4. De unieke waardepropositie helder communiceren

TECHNISCHE EISEN:
- Headlines: STRIKT max 30 karakters (inclusief spaties)
- Descriptions: STRIKT max 90 karakters (inclusief spaties)
- Tel karakters nauwkeurig! Overschrijd NOOIT de limieten.

SCHRIJFREGELS:
- Gebruik actieve, directe taal
- Vermijd generieke zinnen zoals "Bestel nu" of "Klik hier"
- Verwerk keywords natuurlijk in de tekst
- Gebruik cijfers en specifieke voordelen waar mogelijk
- Creëer urgentie zonder clickbait te zijn
- Pas de tone of voice aan op de doelgroep

QUALITY SCORE OPTIMALISATIE:
- Als er landingspagina content is meegegeven: gebruik EXACT dezelfde woorden en termen
- Dit verhoogt de Ad Relevance en Landing Page Experience scores
- Match de messaging en tone van de landingspagina

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug in dit formaat (geen markdown codeblocks):
{
  "headlines": ["headline1", "headline2", ...],
  "descriptions": ["description1", "description2", ...]
}

Genereer minimaal 15 unieke headlines en 4 unieke descriptions.
Varieer in aanpak: sommige met vraag, sommige met voordeel, sommige met actie.`,
    xp_reward: 10,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
  },
}

interface PromptTemplate {
  key: string
  name: string
  system_prompt: string
  model: string
  max_tokens: number
  xp_reward: number
  output_format: string
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set')
      return NextResponse.json(
        { error: 'API configuratie ontbreekt. Contacteer de beheerder.' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const supabase = await createClient()

    const body = await request.json()
    const { tool, prompt, options, clientId } = body

    // Validate input
    if (!tool || !prompt) {
      return NextResponse.json(
        { error: 'Tool and prompt are required' },
        { status: 400 }
      )
    }

    // Get template from database
    const template = await getPromptTemplate(tool)

    if (!template) {
      return NextResponse.json(
        { error: `Template '${tool}' niet gevonden.` },
        { status: 404 }
      )
    }

    // Build system prompt with user context if available
    let systemPrompt = template.system_prompt

    // Add user preferences to context if provided
    if (options?.userContext) {
      const ctx = options.userContext as Record<string, string>
      const contextParts = []
      if (ctx.company_name) contextParts.push(`Bedrijf: ${ctx.company_name}`)
      if (ctx.industry) contextParts.push(`Branche: ${ctx.industry}`)
      if (ctx.target_audience) contextParts.push(`Doelgroep: ${ctx.target_audience}`)
      if (ctx.brand_voice) contextParts.push(`Merkstem: ${ctx.brand_voice}`)
      if (ctx.preferred_tone) contextParts.push(`Toon: ${ctx.preferred_tone}`)

      if (contextParts.length > 0) {
        systemPrompt = `${systemPrompt}\n\nCONTEXT GEBRUIKER:\n${contextParts.join('\n')}`
      }
    }

    // Fetch and add client context if clientId provided
    if (clientId) {
      const clientContext = await getClientContext(supabase, clientId)
      if (clientContext) {
        systemPrompt = `${systemPrompt}\n\n${clientContext}`
      }
    }

    // Call Claude API
    const message = await anthropic.messages.create({
      model: template.model,
      max_tokens: template.max_tokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    let result = textContent ? textContent.text : ''

    // Strip markdown code blocks if present
    if (result.startsWith('```')) {
      result = result.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Calculate tokens used
    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    // Track usage and add XP (fire and forget)
    trackUsageAndXP(tool, template.xp_reward, tokensUsed, message.usage?.input_tokens || 0, message.usage?.output_tokens || 0, clientId)

    return NextResponse.json({
      success: true,
      result,
      tokens_used: tokensUsed,
      template_name: template.name,
    })

  } catch (error) {
    console.error('AI Generation error:', error)

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Ongeldige API key. Controleer de configuratie.' },
          { status: 401 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Te veel verzoeken. Wacht even en probeer opnieuw.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Er ging iets mis bij het genereren. Probeer het opnieuw.' },
      { status: 500 }
    )
  }
}

// Get prompt template from database
async function getPromptTemplate(toolKey: string): Promise<PromptTemplate | null> {
  try {
    const supabase = await createClient()

    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('key, name, system_prompt, model, max_tokens, xp_reward, output_format')
      .eq('key', toolKey)
      .eq('is_active', true)
      .single()

    if (error || !template) {
      console.log(`Template '${toolKey}' not found in database, using fallback`)
      // Return fallback if available
      const fallback = FALLBACK_PROMPTS[toolKey]
      if (fallback) {
        return {
          key: toolKey,
          name: toolKey,
          ...fallback,
          output_format: 'json',
        }
      }
      return null
    }

    return template
  } catch (error) {
    console.error('Error fetching template:', error)
    // Return fallback on error
    const fallback = FALLBACK_PROMPTS[toolKey]
    if (fallback) {
      return {
        key: toolKey,
        name: toolKey,
        ...fallback,
        output_format: 'json',
      }
    }
    return null
  }
}

// Get client context from database
async function getClientContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<string | null> {
  try {
    // Verify client access
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

    if (!clientAccess) {
      console.log('No access to client:', clientId)
      return null
    }

    // Fetch client with context
    const { data: client } = await supabase
      .from('clients')
      .select('name, settings')
      .eq('id', clientId)
      .single()

    if (!client) {
      return null
    }

    const clientName = client.name
    const clientContext = (client.settings as { context?: Record<string, unknown> })?.context

    if (!clientContext) {
      return null
    }

    // Build context string (same format as chat route)
    const ctx = clientContext as {
      proposition?: string
      targetAudience?: string
      usps?: string[]
      toneOfVoice?: string
      brandVoice?: string
      doNots?: string[]
      mustHaves?: string[]
      bestsellers?: string[]
      seasonality?: string[]
      margins?: { min?: number; target?: number }
      activeChannels?: string[]
    }

    const contextParts = [`Je werkt nu voor klant: ${clientName}`]

    if (ctx.proposition) contextParts.push(`Propositie: ${ctx.proposition}`)
    if (ctx.targetAudience) contextParts.push(`Doelgroep: ${ctx.targetAudience}`)
    if (ctx.usps && ctx.usps.length > 0) contextParts.push(`USP's: ${ctx.usps.join(', ')}`)
    if (ctx.toneOfVoice) contextParts.push(`Tone of Voice: ${ctx.toneOfVoice}`)
    if (ctx.brandVoice) contextParts.push(`Brand Voice: ${ctx.brandVoice}`)
    if (ctx.bestsellers && ctx.bestsellers.length > 0) contextParts.push(`Bestsellers: ${ctx.bestsellers.join(', ')}`)
    if (ctx.seasonality && ctx.seasonality.length > 0) contextParts.push(`Seizoensgebonden: ${ctx.seasonality.join(', ')}`)
    if (ctx.margins) contextParts.push(`Marges: min ${ctx.margins.min || 0}%, target ${ctx.margins.target || 0}%`)
    if (ctx.activeChannels && ctx.activeChannels.length > 0) contextParts.push(`Actieve kanalen: ${ctx.activeChannels.join(', ')}`)

    // Compliance rules are critical - add with emphasis
    if (ctx.doNots && ctx.doNots.length > 0) {
      contextParts.push(`\n⚠️ VERBODEN (gebruik deze woorden/claims NOOIT): ${ctx.doNots.join(', ')}`)
    }
    if (ctx.mustHaves && ctx.mustHaves.length > 0) {
      contextParts.push(`✓ VERPLICHT (altijd toevoegen waar relevant): ${ctx.mustHaves.join(', ')}`)
    }

    return `KLANT CONTEXT (${clientName}):\n${contextParts.join('\n')}`
  } catch (error) {
    console.error('Error fetching client context:', error)
    return null
  }
}

// Track usage and add XP to user
async function trackUsageAndXP(
  tool: string,
  xpReward: number,
  totalTokens: number,
  promptTokens: number,
  completionTokens: number,
  clientId?: string
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('No authenticated user for XP tracking')
      return
    }

    // Insert usage record
    await supabase.from('usage').insert({
      user_id: user.id,
      tool,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      client_id: clientId || null,
    })

    // Update user XP and total generations
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, total_generations')
      .eq('id', user.id)
      .single()

    if (profile) {
      const newXp = (profile.xp || 0) + xpReward
      const newLevel = Math.floor(newXp / 100) + 1
      const newGenerations = (profile.total_generations || 0) + 1

      await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          total_generations: newGenerations,
        })
        .eq('id', user.id)
    }
  } catch (error) {
    console.error('Error tracking usage/XP:', error)
  }
}
