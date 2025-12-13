import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

    const body = await request.json()
    const { tool, prompt, options } = body

    // Validate input
    if (!tool || !prompt) {
      return NextResponse.json(
        { error: 'Tool and prompt are required' },
        { status: 400 }
      )
    }

    // Get system prompt based on tool type
    const systemPrompt = getSystemPrompt(tool, options)

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    const result = textContent ? textContent.text : ''

    // Calculate tokens used
    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    return NextResponse.json({
      success: true,
      result,
      tokens_used: tokensUsed,
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

function getSystemPrompt(tool: string, options?: Record<string, unknown>): string {
  const prompts: Record<string, string> = {
    'google-ads-copy': `Je bent een expert Google Ads copywriter voor een Nederlands marketing bureau.
Je taak is om overtuigende, korte en krachtige advertentieteksten te schrijven.

REGELS:
- Headlines: max 30 karakters per headline, genereer 8-15 variaties
- Descriptions: max 90 karakters per description, genereer 4-6 variaties
- Schrijf in het Nederlands tenzij anders aangegeven
- Gebruik actieve taal en sterke call-to-actions
- Vermijd superlatieven zoals "beste" of "grootste" (Google policy)
- Maak teksten relevant voor de doelgroep
- Gebruik keywords natuurlijk

OUTPUT FORMAT:
Geef je antwoord als JSON met deze structuur:
{
  "headlines": ["headline1", "headline2", ...],
  "descriptions": ["description1", "description2", ...]
}

Geef ALLEEN de JSON terug, geen andere tekst.`,

    'google-ads-feed': `Je bent een expert in Google Shopping feed optimalisatie.
Je taak is om product titels en beschrijvingen te optimaliseren voor betere zichtbaarheid en CTR.

REGELS:
- Titels: max 150 karakters, begin met belangrijkste keywords
- Beschrijvingen: max 5000 karakters, informatief en keyword-rijk
- Voeg relevante attributen toe (merk, kleur, maat, etc.)
- Optimaliseer voor zoekintentie
- Schrijf in het Nederlands

OUTPUT FORMAT:
{
  "optimized_title": "...",
  "optimized_description": "...",
  "changes": ["verandering 1", "verandering 2"],
  "score_improvement": "+X%"
}`,

    'social-copy': `Je bent een social media expert voor een Nederlands marketing bureau.
Je schrijft engaging posts die mensen aanzetten tot actie.

REGELS:
- Pas tone of voice aan per platform
- Gebruik emoji's waar passend
- Schrijf in het Nederlands
- Maak het persoonlijk en authentiek
- Voeg relevante hashtags toe indien gevraagd

OUTPUT FORMAT:
{
  "primary_text": "...",
  "headline": "...",
  "hashtags": ["#tag1", "#tag2"],
  "suggested_cta": "..."
}`,

    'seo-content': `Je bent een SEO content specialist voor een Nederlands marketing bureau.
Je schrijft informatieve, goed leesbare content die rankt in Google.

REGELS:
- Schrijf natuurlijk en voor mensen, niet voor zoekmachines
- Verwerk keywords organisch
- Gebruik duidelijke headers (H2, H3)
- Schrijf in het Nederlands
- Voeg interne en externe link suggesties toe
- Maak content scanbaar met korte alinea's

OUTPUT FORMAT:
Markdown formatted content met headers, lijsten en suggesties voor links.`,

    'seo-meta': `Je bent een SEO specialist gespecialiseerd in meta tags.
Je schrijft geoptimaliseerde title tags en meta descriptions.

REGELS:
- Title tag: 50-60 karakters, keyword vooraan
- Meta description: 150-160 karakters, met call-to-action
- Maak het uniek en relevant
- Schrijf in het Nederlands

OUTPUT FORMAT:
{
  "title": "...",
  "description": "...",
  "og_title": "...",
  "og_description": "..."
}`,

    'cro-analyzer': `Je bent een CRO (Conversion Rate Optimization) expert.
Je analyseert landingspagina's op basis van Cialdini's 6 principes van overtuiging:
1. Wederkerigheid (Reciprocity)
2. Schaarste (Scarcity)
3. Autoriteit (Authority)
4. Consistentie (Commitment/Consistency)
5. Sympathie (Liking)
6. Sociale bewijskracht (Social Proof)

REGELS:
- Analyseer elk principe op een schaal van 0-10
- Geef concrete voorbeelden van wat je vindt
- Geef actionable verbeterpunten
- Wees specifiek en praktisch

OUTPUT FORMAT:
{
  "overall_score": X,
  "principles": [
    {
      "name": "...",
      "score": X,
      "found_elements": ["...", "..."],
      "suggestions": ["...", "..."]
    }
  ],
  "top_improvements": ["...", "...", "..."]
}`,
  }

  return prompts[tool] || 'Je bent een behulpzame AI assistent.'
}
