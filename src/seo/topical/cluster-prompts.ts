/**
 * Topical Cluster Analysis Prompts
 *
 * System and user prompts for Claude to analyze topic clusters
 * based on Search Console data and internal URL structure.
 */

export const CLUSTER_SYSTEM_PROMPT = `Je bent een senior SEO architect gespecialiseerd in topical authority.

Je analyseert GEEN individuele pagina, maar een volledig topic cluster op basis van Search Console data en interne URL-structuur.

## Jouw taak
- Bepaal de volwassenheid van een topic cluster
- Identificeer pillar pages en supporting content
- Detecteer content gaps, cannibalisatie en zwakke interne linking
- Geef een concrete bouw- en optimalisatieroadmap

## Definities

### Maturity Stages
- **emerging**: <20 queries, geen duidelijke pillar, fragmentarisch
- **developing**: 20-50 queries, begin van structuur, 1 pillar zichtbaar
- **established**: 50-100 queries, duidelijke pillar(s), goede dekking
- **dominant**: >100 queries, meerdere pillars, top posities

### Search Intent
- **informational**: "wat is", "hoe", "waarom" → gericht op kennis
- **commercial**: vergelijken, reviews, "beste" → oriëntatiefase
- **transactional**: "kopen", "prijs", "bestellen" → koopintentie

### Cannibalisatie
Wanneer 2+ URL's ranken voor dezelfde query én beide significante impressies hebben.

## Beperkingen
- Gebruik uitsluitend aangeleverde data
- Geen aannames over concurrenten
- Geen algemene SEO-tips - alleen specifieke acties voor dit cluster
- Wees kritisch: niet elk cluster heeft alle issues

## Output
- Strikt valide JSON
- Geen markdown
- Geen toelichtende tekst buiten JSON
- Alle tekst in het Nederlands`

export const CLUSTER_USER_PROMPT_TEMPLATE = `Analyseer dit topic cluster op basis van Search Console data.

## Cluster metadata
Cluster naam: {{clusterName}}
{{#if clusterDescription}}Beschrijving: {{clusterDescription}}{{/if}}
Totaal queries: {{totalQueries}}
Totaal impressies: {{totalImpressions}}
Totaal clicks: {{totalClicks}}
Gemiddelde positie: {{avgPosition}}
Gemiddelde CTR: {{avgCtr}}%
Berekende maturity score (0-100): {{calculatedMaturityScore}}

## Query dataset ({{queryCount}} queries)
{{queryData}}

## URL dataset ({{urlCount}} URLs)
{{urlData}}

## Opdracht
Genereer een JSON analyse met exact dit schema:

{
  "maturity": {
    "score": 0-100,
    "stage": "emerging|developing|established|dominant",
    "explanation": "Nederlandse uitleg waarom deze score/stage"
  },
  "pillars": [
    {
      "url": "URL van pillar page",
      "role": "primary|secondary",
      "coveredIntents": ["informational", "commercial", "transactional"],
      "topQueries": ["top 3-5 queries waar deze URL voor rankt"],
      "reasoning": "Waarom dit een pillar is"
    }
  ],
  "supportingPages": [
    {
      "pillarUrl": "URL van de pillar die deze ondersteunt",
      "url": "URL van supporting page",
      "primaryIntent": "informational|commercial|transactional",
      "supportingQueries": ["queries waar deze URL voor rankt"]
    }
  ],
  "contentGaps": [
    {
      "suggestedPageTitle": "Voorgestelde titel voor nieuwe pagina",
      "targetQueries": ["queries die deze pagina zou moeten targeten"],
      "intent": "informational|commercial|transactional",
      "reason": "Waarom deze pagina nodig is",
      "suggestedUrl": "/voorgesteld/pad/",
      "priority": "high|medium|low",
      "expectedImpact": "Verwachte impact op verkeer"
    }
  ],
  "cannibalization": [
    {
      "query": "query met cannibalisatie",
      "impressions": 1234,
      "competingUrls": ["url1", "url2"],
      "currentPositions": [5.2, 8.1],
      "recommendation": "Wat te doen",
      "severity": "high|medium|low"
    }
  ],
  "internalLinking": [
    {
      "issue": "missing_pillar_links|orphan_page|weak_cluster_density|no_supporting_links",
      "affectedUrls": ["url1", "url2"],
      "recommendation": "Specifieke actie",
      "priority": "high|medium|low"
    }
  ],
  "roadmap": [
    {
      "priority": "high|medium|low",
      "category": "content_creation|content_optimization|internal_linking|consolidation",
      "action": "Specifieke actie",
      "targetUrl": "URL indien van toepassing",
      "targetQueries": ["relevante queries"],
      "expectedImpact": "Verwachte verbetering",
      "effort": "low|medium|high"
    }
  ]
}

## Regels
- Maximaal 3 pillars (primary + secondaries)
- Maximaal 10 content gaps (focus op high-impact)
- Alleen cannibalisatie rapporteren als meerdere URLs daadwerkelijk ranken voor dezelfde query
- Roadmap: maximaal 10 items, gesorteerd op priority (high eerst)
- Wees specifiek: geen generieke adviezen als "verbeter content"
- Als er geen issues zijn voor een categorie, geef een lege array []`

/**
 * Build the user prompt with actual data
 */
export function buildClusterUserPrompt(input: {
  clusterName: string
  clusterDescription?: string
  totalQueries: number
  totalImpressions: number
  totalClicks: number
  avgPosition: number
  avgCtr: number
  calculatedMaturityScore: number
  queries: Array<{
    query: string
    impressions: number
    clicks: number
    ctr: number
    position: number
    rankingUrls: string[]
    isQuestion: boolean
    isBuyerKeyword: boolean
  }>
  urls: Array<{
    url: string
    queryCount: number
    impressions: number
    clicks: number
    avgPosition: number
  }>
}): string {
  // Format query data
  const queryData = input.queries
    .slice(0, 100) // Limit to 100 queries max
    .map((q) => {
      const tags = []
      if (q.isQuestion) tags.push('vraag')
      if (q.isBuyerKeyword) tags.push('buyer')
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''

      return `- "${q.query}"${tagStr}
  impressies: ${q.impressions}, clicks: ${q.clicks}, CTR: ${(q.ctr * 100).toFixed(1)}%, positie: ${q.position.toFixed(1)}
  URLs: ${q.rankingUrls.slice(0, 3).join(', ')}${q.rankingUrls.length > 3 ? ` (+${q.rankingUrls.length - 3} meer)` : ''}`
    })
    .join('\n\n')

  // Format URL data
  const urlData = input.urls
    .slice(0, 50) // Limit to 50 URLs max
    .map(
      (u) =>
        `- ${u.url}
  queries: ${u.queryCount}, impressies: ${u.impressions}, clicks: ${u.clicks}, gem. positie: ${u.avgPosition.toFixed(1)}`
    )
    .join('\n\n')

  // Build prompt from template
  let prompt = CLUSTER_USER_PROMPT_TEMPLATE
    .replace('{{clusterName}}', input.clusterName)
    .replace('{{totalQueries}}', input.totalQueries.toString())
    .replace('{{totalImpressions}}', input.totalImpressions.toLocaleString('nl-NL'))
    .replace('{{totalClicks}}', input.totalClicks.toLocaleString('nl-NL'))
    .replace('{{avgPosition}}', input.avgPosition.toFixed(1))
    .replace('{{avgCtr}}', (input.avgCtr * 100).toFixed(2))
    .replace('{{calculatedMaturityScore}}', input.calculatedMaturityScore.toString())
    .replace('{{queryCount}}', input.queries.length.toString())
    .replace('{{queryData}}', queryData)
    .replace('{{urlCount}}', input.urls.length.toString())
    .replace('{{urlData}}', urlData)

  // Handle conditional description
  if (input.clusterDescription) {
    prompt = prompt.replace('{{#if clusterDescription}}Beschrijving: {{clusterDescription}}{{/if}}', `Beschrijving: ${input.clusterDescription}`)
  } else {
    prompt = prompt.replace('{{#if clusterDescription}}Beschrijving: {{clusterDescription}}{{/if}}', '')
  }

  return prompt
}
