/**
 * Context Generator Service
 *
 * Generates AI Context from scraped sources, user input, and existing context.
 * Implements merge rules and source mapping for explainability.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  AIContext,
  ContextSummary,
  SourceMap,
  validateContext,
  formatValidationErrors,
  CONFIDENCE_OVERWRITE_THRESHOLD,
  createEmptyContext,
} from '@/lib/context'
import type { ScrapedSource, IntakeAnswer } from '@/lib/context/types'

// ============================================
// TYPES
// ============================================

interface GenerateContextInput {
  clientId: string
  clientName: string
  scrapedSources: ScrapedSource[]
  intakeAnswers: IntakeAnswer[]
  existingContext: AIContext | null
  userId: string
  jobId: string
}

interface GenerateContextResult {
  success: boolean
  context?: AIContext
  summary?: ContextSummary
  sourceMap?: SourceMap
  version?: number
  error?: string
}

// ============================================
// LLM PROMPT TEMPLATES
// ============================================

const CONTEXT_EXTRACTION_PROMPT = `Je bent een senior marketeer en brand strategist die klantcontext analyseert voor marketing automation.

Analyseer de aangeleverde bronnen en extraheer een gestructureerd klantprofiel.

## Input bronnen:
{sources_content}

## Eventuele user input:
{user_input}

## Bestaande context (indien aanwezig):
{existing_context}

## Extractie instructies:

1. **Observations (Waarnemingen)**
   - companyName: Bedrijfsnaam
   - website: Website URL
   - industry/subIndustry: Branche en subbranche
   - proposition: Kernpropositie (2-3 zinnen)
   - tagline: Eventuele tagline
   - targetAudience: Doelgroep met demographics en psychographics
   - usps: 3-5 onderscheidende punten met confidence score
   - products: Belangrijkste producten/diensten
   - bestsellers: Meest prominente producten
   - brandVoice: Toon, persoonlijkheid, do's en don'ts

2. **Goals (Doelen)** - indien te achterhalen
   - Business doelen
   - Marketing doelen
   - KPIs

3. **Economics (Economie)** - indien te achterhalen
   - Prijsrange
   - Marges (indien bekend)
   - Seizoensgebondenheid

4. **Competitors (Concurrenten)** - alleen als scraped
   - Directe concurrenten
   - Positionering t.o.v. concurrenten

5. **Access (Kanalen)**
   - Actieve marketing kanalen (op basis van content)
   - Sociale media aanwezigheid

## Merge regels:
- User input > AI observatie (altijd prioriteit aan expliciete input)
- Recente data > oude data
- Bij confidence < 0.6 mag je overschrijven met nieuwe data
- Handmatige overrides (uit bestaande context) behouden

## Output format:

Geef je antwoord in het volgende JSON formaat. Wees zo compleet mogelijk maar verzin geen informatie:

\`\`\`json
{
  "schemaVersion": "1.0",
  "observations": {
    "companyName": "string",
    "website": "url (optional)",
    "industry": "string (optional)",
    "subIndustry": "string (optional)",
    "proposition": "string (optional)",
    "tagline": "string (optional)",
    "targetAudience": {
      "primary": "string",
      "secondary": "string (optional)",
      "demographics": { "ageRange": "string", "location": ["string"] },
      "psychographics": { "interests": ["string"], "painPoints": ["string"] }
    },
    "usps": [{ "text": "string", "confidence": "high|medium|low" }],
    "products": [{ "name": "string", "description": "string", "isBestseller": boolean }],
    "bestsellers": ["string"],
    "brandVoice": {
      "toneOfVoice": "string",
      "personality": ["string"],
      "doNots": ["string"],
      "mustHaves": ["string"]
    }
  },
  "goals": {
    "primary": ["string"],
    "marketing": { "awareness": boolean, "leads": boolean, "sales": boolean }
  },
  "economics": {
    "priceRange": { "min": number, "max": number, "currency": "EUR" },
    "seasonality": [{ "period": "string", "impact": "peak|high|normal|low" }]
  },
  "competitors": {
    "direct": [{ "name": "string", "website": "url", "positioning": "string" }]
  },
  "access": {
    "activeChannels": ["google_ads", "meta", "seo", "linkedin", "email", "content"],
    "social": { "linkedin": "url", "instagram": "url" }
  },
  "nextActions": [
    {
      "id": "uuid",
      "title": "string",
      "priority": "high|medium|low",
      "category": "intake|setup|optimization|strategy|content|technical"
    }
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "sections": {
      "observations": 0.0-1.0,
      "goals": 0.0-1.0
    },
    "lowConfidenceFields": ["field.path"],
    "missingFields": ["field.path"]
  },
  "gaps": {
    "critical": [{ "field": "string", "reason": "string" }],
    "questionsToAsk": [{ "questionKey": "string", "questionText": "string", "priority": "high|medium|low" }]
  },
  "lastUpdated": "ISO datetime"
}
\`\`\`

Alleen de velden opnemen waar je daadwerkelijk informatie voor hebt. Laat optionele velden weg als je geen data hebt.`

const SUMMARY_PROMPT = `Maak een beknopte samenvatting van de volgende klantcontext voor gebruik in AI prompts:

{context}

Genereer:
1. oneLiner: Eén zin die het bedrijf beschrijft
2. shortDescription: 2-3 zinnen voor context
3. keyFacts: 4-6 belangrijke punten als bullet points
4. promptContext: Een paragraaf (max 150 woorden) die direct in AI prompts kan worden gebruikt

Output in JSON:
\`\`\`json
{
  "oneLiner": "string",
  "shortDescription": "string",
  "keyFacts": ["string"],
  "promptContext": "string"
}
\`\`\``

// ============================================
// HELPER FUNCTIONS
// ============================================

function prepareSourcesContent(sources: ScrapedSource[]): string {
  if (sources.length === 0) {
    return 'Geen bronnen beschikbaar.'
  }

  return sources
    .filter((s) => s.extraction_success && s.raw_content)
    .map((source) => {
      const pageType = source.page_type || 'unknown'
      const isCompetitor = source.is_competitor ? ` (CONCURRENT: ${source.competitor_name})` : ''
      const content = source.raw_content?.substring(0, 6000) || ''

      return `### ${source.title || source.url}${isCompetitor}
Type: ${pageType} | URL: ${source.url}

${content}

---`
    })
    .join('\n\n')
}

function prepareUserInput(answers: IntakeAnswer[]): string {
  if (answers.length === 0) {
    return 'Geen user input beschikbaar.'
  }

  return answers
    .filter((a) => a.is_active)
    .map((answer) => {
      const value = answer.answer_text || JSON.stringify(answer.answer_json)
      return `- ${answer.question_key}: ${value}`
    })
    .join('\n')
}

function buildSourceMap(
  sources: ScrapedSource[],
  answers: IntakeAnswer[],
  existingContext: AIContext | null
): SourceMap {
  const sourceMap: SourceMap = {}

  // Mark fields from scraped sources
  sources.forEach((source) => {
    if (!source.extraction_success) return

    const sourceType = source.is_competitor
      ? 'scrape:competitor'
      : source.source_type.startsWith('social_')
      ? 'scrape:social'
      : 'scrape:website'

    // We'll refine this after LLM extraction
    // For now, mark that we have website data
    if (sourceType === 'scrape:website') {
      sourceMap['observations'] = [sourceType as 'scrape:website']
    }
    if (sourceType === 'scrape:competitor') {
      sourceMap['competitors'] = [sourceType as 'scrape:competitor']
    }
  })

  // Mark fields from user input
  answers.forEach((answer) => {
    sourceMap[answer.question_key] = ['user:intake']
  })

  // Mark preserved fields from existing context
  if (existingContext) {
    // If there were manual overrides, mark them
    sourceMap['_preserved'] = ['manual:override']
  }

  return sourceMap
}

function enhanceSourceMap(
  baseMap: SourceMap,
  context: AIContext
): SourceMap {
  const enhanced: SourceMap = { ...baseMap }

  // Add AI inference markers for fields that were derived
  const addInference = (path: string) => {
    if (!enhanced[path]) {
      enhanced[path] = ['ai:inference']
    } else if (!enhanced[path].includes('ai:inference')) {
      enhanced[path].push('ai:inference')
    }
  }

  // Mark inferred fields
  if (context.observations.proposition) {
    addInference('observations.proposition')
  }
  if (context.observations.targetAudience) {
    addInference('observations.targetAudience')
  }
  if (context.observations.usps && context.observations.usps.length > 0) {
    addInference('observations.usps')
  }
  if (context.goals) {
    addInference('goals')
  }
  if (context.economics) {
    addInference('economics')
  }
  if (context.nextActions && context.nextActions.length > 0) {
    addInference('nextActions')
  }

  return enhanced
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Generate AI Context from sources using LLM
 */
export async function generateContextFromSources(
  input: GenerateContextInput
): Promise<GenerateContextResult> {
  const { clientId, clientName, scrapedSources, intakeAnswers, existingContext, userId, jobId } = input

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' }
  }

  // Check if we have any sources (required for generation)
  const hasScrapedData = scrapedSources.some((s) => s.extraction_success)
  const hasUserInput = intakeAnswers.length > 0

  if (!hasScrapedData && !hasUserInput && !existingContext) {
    return { success: false, error: 'No data sources available for context generation' }
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Prepare prompt content
    const sourcesContent = prepareSourcesContent(scrapedSources)
    const userInput = prepareUserInput(intakeAnswers)
    const existingContextStr = existingContext
      ? JSON.stringify(existingContext, null, 2)
      : 'Geen bestaande context.'

    // Build the prompt
    const prompt = CONTEXT_EXTRACTION_PROMPT
      .replace('{sources_content}', sourcesContent)
      .replace('{user_input}', userInput)
      .replace('{existing_context}', existingContextStr)

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: 'Je bent een expert in klantanalyse en marketing strategie. Antwoord altijd in valid JSON.',
    })

    // Extract JSON from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.error('No JSON found in LLM response:', responseText)
      return { success: false, error: 'Failed to parse LLM response' }
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    let parsedContext: AIContext

    try {
      parsedContext = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, jsonStr)
      return { success: false, error: 'Invalid JSON in LLM response' }
    }

    // Validate against schema
    const validation = validateContext(parsedContext)
    if (!validation.success) {
      console.error('Context validation failed:', formatValidationErrors(validation.errors!))
      console.error('Parsed context was:', JSON.stringify(parsedContext, null, 2))

      // Try to fix common issues by merging with empty context
      const fixedContext = {
        ...createEmptyContext(clientName),
        ...parsedContext,
        schemaVersion: '1.0',
        lastUpdated: new Date().toISOString(),
        // Ensure observations has required companyName
        observations: {
          ...createEmptyContext(clientName).observations,
          ...(parsedContext.observations || {}),
          companyName: parsedContext.observations?.companyName || clientName,
        },
        // Ensure confidence exists
        confidence: parsedContext.confidence || {
          overall: 0.5,
          bySection: {},
          missingFields: [],
          lastUpdated: new Date().toISOString(),
        },
      }

      // Validate again
      const revalidation = validateContext(fixedContext)
      if (!revalidation.success) {
        console.error('Revalidation also failed:', formatValidationErrors(revalidation.errors!))
        console.error('Fixed context was:', JSON.stringify(fixedContext, null, 2))
        return { success: false, error: 'Context schema validation failed: ' + formatValidationErrors(revalidation.errors!) }
      }
      parsedContext = revalidation.data!
    } else {
      parsedContext = validation.data!
    }

    // Build source map
    let sourceMap = buildSourceMap(scrapedSources, intakeAnswers, existingContext)
    sourceMap = enhanceSourceMap(sourceMap, parsedContext)

    // Generate summary
    const summaryResult = await generateSummary(anthropic, parsedContext)
    const summary = summaryResult.success ? summaryResult.summary : undefined

    // Save to database
    const supabase = await createClient()

    // Create new version
    const { data: versionResult, error: versionError } = await supabase.rpc(
      'create_context_version',
      {
        p_client_id: clientId,
        p_context_json: parsedContext,
        p_summary_json: summary || null,
        p_source_map: sourceMap,
        p_generated_by: 'intake',
        p_user_id: userId,
        p_job_id: jobId,
        p_auto_activate: true, // Auto-activate for new intakes
      }
    )

    if (versionError) {
      console.error('Error creating context version:', versionError)
      // Check if it's a missing table/function error
      if (versionError.message?.includes('does not exist') || versionError.code === '42883') {
        return {
          success: false,
          error: 'Database migration not run. Please run the customer-context-layer.sql migration first.'
        }
      }
      return { success: false, error: 'Failed to save context version: ' + versionError.message }
    }

    return {
      success: true,
      context: parsedContext,
      summary,
      sourceMap,
      version: versionResult,
    }
  } catch (error) {
    console.error('Context generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate a summary for the context
 */
async function generateSummary(
  anthropic: Anthropic,
  context: AIContext
): Promise<{ success: boolean; summary?: ContextSummary; error?: string }> {
  try {
    const prompt = SUMMARY_PROMPT.replace('{context}', JSON.stringify(context, null, 2))

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return { success: false, error: 'No JSON in summary response' }
    }

    const summary: ContextSummary = JSON.parse(jsonMatch[1] || jsonMatch[0])
    return { success: true, summary }
  } catch (error) {
    console.error('Summary generation error:', error)
    return { success: false, error: 'Summary generation failed' }
  }
}

/**
 * Enrich existing context with new data
 */
export async function enrichContext(
  clientId: string,
  newAnswers: IntakeAnswer[],
  userId: string
): Promise<GenerateContextResult> {
  const supabase = await createClient()

  // Get existing context
  const { data: existingData, error: existingError } = await supabase
    .from('client_context')
    .select('current_context_json, active_version')
    .eq('client_id', clientId)
    .single()

  if (existingError || !existingData?.current_context_json) {
    return { success: false, error: 'No existing context to enrich' }
  }

  // Get client name
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single()

  // Get all active answers including new ones
  const { data: allAnswers } = await supabase
    .from('intake_answers')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)

  // Use the same generation flow but with enrichment flag
  return generateContextFromSources({
    clientId,
    clientName: client?.name || 'Unknown',
    scrapedSources: [], // No new scraping for enrichment
    intakeAnswers: allAnswers || newAnswers,
    existingContext: existingData.current_context_json as AIContext,
    userId,
    jobId: '', // No job for enrichment
  })
}
