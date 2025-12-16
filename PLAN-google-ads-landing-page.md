# Plan: Google Ads Copy Generator met Landingspagina Content

## Waarom dit idee goed is

Google's Quality Score wordt bepaald door 3 factoren:
1. **Expected CTR** - Hoe waarschijnlijk is het dat iemand klikt
2. **Ad Relevance** - Hoe goed matcht de advertentie met de zoekintentie
3. **Landing Page Experience** - Hoe relevant is de landingspagina

Door de landingspagina content te gebruiken als input voor de advertentieteksten:
- Zorgen we voor **consistente messaging** (advertentie <-> landingspagina)
- Extraheren we **echte keywords en USP's** die op de pagina staan
- Verbeteren we de **Ad Relevance** score
- Verhogen we de kans op een hogere **Quality Score** (= lagere CPC!)

---

## Architectuur Overzicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Ads Copy Generator                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │   URL Input      │────▶│  /api/fetch-url  │                  │
│  │   (Optional)     │     │  (Edge Function) │                  │
│  └──────────────────┘     └────────┬─────────┘                  │
│                                    │                             │
│                                    ▼                             │
│                           ┌──────────────────┐                  │
│                           │ Content Extractor│                  │
│                           │ - Title          │                  │
│                           │ - Meta desc      │                  │
│                           │ - H1/H2 headers  │                  │
│                           │ - Main content   │                  │
│                           │ - Keywords       │                  │
│                           └────────┬─────────┘                  │
│                                    │                             │
│  ┌──────────────────┐              │                             │
│  │ Manual Input     │              │                             │
│  │ - Product naam   │◀─────────────┤                             │
│  │ - Beschrijving   │  (Pre-fill)  │                             │
│  │ - Keywords       │              │                             │
│  └────────┬─────────┘              │                             │
│           │                        │                             │
│           ▼                        ▼                             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  /api/generate                        │       │
│  │  tool: 'google-ads-copy'                              │       │
│  │  + landingPageContent (extracted)                     │       │
│  │  + clientContext (existing)                           │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │               Headlines & Descriptions                │       │
│  │  (Geoptimaliseerd voor Quality Score)                 │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementatie Stappen

### Stap 1: API Route `/api/fetch-url` (Edge Function)

**Locatie:** `src/app/api/fetch-url/route.ts`

**Functionaliteit:**
- Accepteert een URL als input
- Haalt de HTML op via fetch (edge runtime)
- Extraheert relevante content:
  - `<title>` tag
  - `<meta name="description">`
  - `<h1>`, `<h2>` headers
  - Main content (paragraphs)
  - Keywords (via frequentie analyse of meta keywords)
- Optioneel: Gebruik Tavily Extract API voor betere parsing

**Response:**
```typescript
interface FetchUrlResponse {
  success: boolean
  url: string
  content: {
    title: string
    metaDescription: string
    headers: string[]
    mainContent: string      // Truncated to ~2000 chars
    extractedKeywords: string[]
  }
}
```

**Beveiligingsmaatregelen:**
- URL validatie (alleen http/https)
- Rate limiting
- Timeout (max 10 seconden)
- Content size limit (max 500KB)

---

### Stap 2: Update Google Ads Copy Page

**Locatie:** `src/app/(dashboard)/google-ads/copy/page.tsx`

**Nieuwe velden:**
```typescript
interface FormData {
  // Bestaand
  productName: string
  productDescription: string
  targetAudience: string
  keywords: string
  tone: string
  adType: string

  // Nieuw
  landingPageUrl: string        // URL input
  useLandingPageContent: boolean // Toggle
}
```

**UI Wijzigingen:**
1. Nieuw **URL input veld** bovenaan het formulier
2. **"Analyseer pagina" button** met loading state
3. **Preview van geëxtraheerde content** (collapse/expand)
4. Optie om geëxtraheerde data te **pre-fillen** in bestaande velden
5. Toggle om landingspagina content mee te sturen naar AI

**UX Flow:**
1. Gebruiker plakt URL
2. Klikt "Analyseer pagina"
3. Content wordt opgehaald en getoond in preview
4. Velden worden automatisch ingevuld (indien leeg)
5. Gebruiker kan aanpassen
6. Bij genereren wordt landingspagina content als extra context meegegeven

---

### Stap 3: Update Generate API

**Locatie:** `src/app/api/generate/route.ts`

**Wijzigingen:**
- Nieuwe `options.landingPageContent` parameter accepteren
- Dit toevoegen aan de prompt context

**Prompt Enhancement:**
```typescript
if (options?.landingPageContent) {
  const lp = options.landingPageContent
  prompt += `

LANDINGSPAGINA ANALYSE:
- Pagina titel: ${lp.title}
- Meta description: ${lp.metaDescription}
- Belangrijke koppen: ${lp.headers.join(', ')}
- Gevonden keywords: ${lp.extractedKeywords.join(', ')}

BELANGRIJK: Gebruik de woorden en thema's van de landingspagina in je advertentieteksten
om de relevantie en Quality Score te verbeteren. Zorg dat de messaging consistent is.`
}
```

---

### Stap 4: Update Prompt Template (Database)

**Tabel:** `prompt_templates`

**Update `google-ads-copy` template:**
```sql
UPDATE prompt_templates
SET system_prompt = '
Je bent een expert Google Ads copywriter met focus op Quality Score optimalisatie.

DOEL: Genereer advertentieteksten die:
1. Maximaal relevant zijn voor de zoekintentie
2. Consistent zijn met de landingspagina messaging
3. Gebruik maken van keywords die op de landingspagina staan
4. De CTR verhogen door overtuigende copy

OUTPUT FORMAAT: JSON met headlines (max 30 chars) en descriptions (max 90 chars).
Genereer minimaal 15 headlines en 4 descriptions.

QUALITY SCORE TIPS die je toepast:
- Gebruik exacte woorden van de landingspagina
- Match de tone of voice van de landingspagina
- Herhaal key USPs die op de pagina staan
- Gebruik actieve, overtuigende taal
'
WHERE key = 'google-ads-copy';
```

---

### Stap 5: Keywords Extraction Logic

**Optie A: Simple (in-house)**
```typescript
function extractKeywords(text: string): string[] {
  // Remove common words (Dutch stopwords)
  const stopwords = ['de', 'het', 'een', 'van', 'en', 'in', 'op', 'te', 'voor', ...]

  // Tokenize and count frequency
  const words = text.toLowerCase().split(/\W+/)
  const frequency = words.reduce((acc, word) => {
    if (word.length > 3 && !stopwords.includes(word)) {
      acc[word] = (acc[word] || 0) + 1
    }
    return acc
  }, {})

  // Return top 10 most frequent
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}
```

**Optie B: Tavily Extract API**
- Betere content extraction
- Cleaner text output
- Kost extra API calls

**Aanbeveling:** Start met Optie A (gratis, snel), migreer naar B indien nodig.

---

## Bestandswijzigingen Overzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/app/api/fetch-url/route.ts` | **NIEUW** | Edge function voor URL content ophalen |
| `src/app/(dashboard)/google-ads/copy/page.tsx` | **UPDATE** | URL input + preview + pre-fill logic |
| `src/app/api/generate/route.ts` | **UPDATE** | Accept landingPageContent option |
| `src/types/index.ts` | **UPDATE** | Types voor LandingPageContent |
| Database: `prompt_templates` | **UPDATE** | Enhanced google-ads-copy prompt |

---

## Technische Details

### Edge Function Beperkingen
- Max execution time: 30 seconden (Vercel Edge)
- Max response size: 4MB
- Geen Node.js modules (alleen Web APIs)

### Content Extraction Strategie
```typescript
// Simpele HTML parser voor edge runtime
function parseHTML(html: string) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

  // Extract meta description
  const metaDescMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  )

  // Extract headers
  const headers = [...html.matchAll(/<h[12][^>]*>([^<]+)<\/h[12]>/gi)]
    .map(m => m[1].trim())

  // Extract text content (strip tags)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)  // Limit content length

  return { title, metaDescription, headers, textContent }
}
```

---

## XP & Usage Tracking

| Actie | XP |
|-------|-----|
| URL analyseren | +3 XP |
| Google Ads copy genereren (met landing page) | +15 XP |
| Google Ads copy genereren (zonder) | +10 XP (bestaand) |

---

## Risico's & Mitigaties

| Risico | Mitigatie |
|--------|-----------|
| CORS blocking | Server-side fetch (edge function) |
| Rate limiting door doelsite | Caching (5 min), retry met backoff |
| Zeer grote pagina's | Content truncation (max 5000 chars) |
| JavaScript-only content (SPA's) | Warning aan gebruiker, fallback op manual input |
| Malicious URLs | URL validation, domain whitelist optioneel |

---

## Toekomstige Uitbreidingen

1. **Batch URL analyse** - Meerdere URL's tegelijk analyseren
2. **Competitor analyse** - Vergelijk met competitor landingspagina's
3. **A/B suggesties** - Genereer variaties voor testing
4. **Keyword gap analyse** - Welke keywords missen op de pagina?
5. **Quality Score voorspelling** - Estimate score op basis van match

---

## Acceptatiecriteria

- [ ] Gebruiker kan een URL invoeren
- [ ] Landingspagina content wordt correct opgehaald
- [ ] Content wordt getoond in een preview
- [ ] Velden worden automatisch ingevuld
- [ ] Gegenereerde advertenties bevatten woorden van de landingspagina
- [ ] Error handling voor onbereikbare URL's
- [ ] Loading states zijn correct
- [ ] XP tracking werkt

---

## Geschatte Effort

| Component | Complexiteit |
|-----------|--------------|
| API `/api/fetch-url` | Medium |
| UI Updates | Medium |
| Generate API update | Low |
| Testing | Medium |
| **Totaal** | **~4-6 uur development** |
