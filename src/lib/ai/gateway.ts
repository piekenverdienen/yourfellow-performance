/**
 * AI Gateway Service - MVP Version
 *
 * Minimal viable gateway for AI operations.
 * Focus: simple flow, one provider, basic logging.
 *
 * Flow: Request → Model Selection → Template → Provider → Response + Logging
 *
 * MVP SCOPE:
 * ✓ Text generation only
 * ✓ Anthropic provider (primary)
 * ✓ Hardcoded fallback templates
 * ✓ Client context injection
 * ✓ Basic usage logging (existing 'usage' table)
 *
 * ROADMAP (not implemented):
 * - Multi-provider fallback (see providers/)
 * - Database templates with versioning (see supabase-ai-gateway.sql)
 * - A/B testing
 * - Evaluations (see evaluator.ts)
 * - Image generation
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getModelForTask, calculateCost } from './models'
import type {
  AIGenerateRequest,
  AIResult,
  AITask,
  AIClientContext,
} from './types'

// ============================================
// Simple Template Type (MVP)
// ============================================

interface SimpleTemplate {
  id: string
  task: AITask
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens: number
  xpReward: number
}

// ============================================
// Hardcoded Templates (MVP)
// ============================================
// Later: move to database via supabase-ai-gateway.sql

const TEMPLATES: Record<string, SimpleTemplate> = {
  google_ads_copy: {
    id: 'google-ads-copy-v1',
    task: 'google_ads_copy',
    systemPrompt: `Je bent een ervaren Google Ads copywriter gespecialiseerd in het schrijven van advertenties met hoge Quality Scores.

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

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug in dit formaat (geen markdown codeblocks):
{
  "headlines": ["headline1", "headline2", ...],
  "descriptions": ["description1", "description2", ...]
}

Genereer minimaal 15 unieke headlines en 4 unieke descriptions.`,
    userPromptTemplate: `Product: {{product_name}}
Beschrijving: {{product_description}}
Doelgroep: {{target_audience}}
Keywords: {{keywords}}
Tone: {{tone}}
{{landing_page_content}}`,
    temperature: 0.7,
    maxTokens: 2048,
    xpReward: 10,
  },

  image_prompt: {
    id: 'image-prompt-v1',
    task: 'image_prompt',
    systemPrompt: `Je bent een expert image prompt engineer. Je analyseert social media posts en schrijft visueel beschrijvende prompts voor AI image generators.

REGELS:
- Schrijf ALLEEN de image prompt, geen uitleg
- Prompt moet in het ENGELS zijn
- NOOIT tekst, woorden, letters of logo's beschrijven (AI kan dit niet)
- Beschrijf: onderwerp, setting, belichting, stijl, kleuren, compositie, sfeer
- Gebruik beschrijvende bijvoeglijke naamwoorden
- Max 80 woorden`,
    userPromptTemplate: `Platform: {{platform}}
Post inhoud: {{content}}`,
    temperature: 0.8,
    maxTokens: 500,
    xpReward: 5,
  },

  social_post: {
    id: 'social-post-v1',
    task: 'social_post',
    systemPrompt: `Je bent een social media expert die engaging posts schrijft voor diverse platformen.

PLATFORM STIJLEN:
- LinkedIn: Professioneel, thought leadership, langere tekst toegestaan, geen hashtag-spam
- Instagram: Visueel, storytelling, emoji's welkom, relevante hashtags
- Facebook: Conversational, community-gericht, persoonlijk
- Twitter/X: Kort, puntig, max 280 karakters, trending topics

SCHRIJFREGELS:
- Schrijf in het Nederlands tenzij anders gevraagd
- Pas toon aan op platform én doelgroep
- Begin met een hook die aandacht trekt
- Eindig met een duidelijke call-to-action
- Hashtags: relevant en niet overdreven (max 5 voor Instagram, max 3 voor LinkedIn)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "primary_text": "De hoofdtekst van de post",
  "headline": "Optionele headline (vooral voor LinkedIn)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "suggested_cta": "Voorgestelde call-to-action"
}`,
    userPromptTemplate: `Platform: {{platform}}
Onderwerp: {{topic}}
Context: {{context}}
Doelgroep: {{target_audience}}
Tone of voice: {{tone}}
Type post: {{post_type}}`,
    temperature: 0.8,
    maxTokens: 1024,
    xpReward: 8,
  },

  seo_content: {
    id: 'seo-content-v1',
    task: 'seo_content',
    systemPrompt: `Je bent een SEO content specialist die informatieve, goed leesbare content schrijft die rankt in Google.

SEO PRINCIPES:
- Verwerk het primair keyword in de titel en eerste alinea
- Gebruik secundaire keywords natuurlijk door de tekst
- Keyword dichtheid: 1-2% (niet meer, niet minder)
- Gebruik H2 en H3 headers met relevante keywords
- Schrijf korte alinea's (max 3-4 zinnen)
- Gebruik bullet points waar relevant

STRUCTUUR:
- Start met een sterke introductie die de lezer pakt
- Gebruik duidelijke tussenkoppen (## en ###)
- Eindig met een conclusie en call-to-action

LENGTE RICHTLIJNEN:
- short: 300-500 woorden
- medium: 500-800 woorden
- long: 800-1200 woorden
- comprehensive: 1200+ woorden

OUTPUT:
Schrijf de content in Markdown formaat met headers. Geen JSON.`,
    userPromptTemplate: `Onderwerp: {{topic}}
Primair keyword: {{primary_keyword}}
Secundaire keywords: {{secondary_keywords}}
Doelgroep: {{target_audience}}
Type content: {{content_type}}
Gewenste lengte: {{length}}
Tone of voice: {{tone}}`,
    temperature: 0.7,
    maxTokens: 4096,
    xpReward: 15,
  },

  seo_meta: {
    id: 'seo-meta-v1',
    task: 'seo_meta',
    systemPrompt: `Je bent een SEO specialist die geoptimaliseerde meta tags schrijft voor betere CTR in zoekresultaten.

TECHNISCHE EISEN:
- Title tag: 50-60 karakters (inclusief spaties)
- Meta description: 150-160 karakters (inclusief spaties)
- Tel karakters nauwkeurig!

SCHRIJFREGELS:
- Verwerk het primair keyword vooraan in de title
- Maak de description een compelling samenvatting
- Gebruik actieve taal die aanzet tot klikken
- Voeg merkNaam toe aan title indien opgegeven (bijv. "... | MerkNaam")
- OG tags mogen iets langer/anders zijn dan reguliere meta tags

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "title": "De title tag (50-60 karakters)",
  "description": "De meta description (150-160 karakters)",
  "og_title": "Open Graph title",
  "og_description": "Open Graph description"
}`,
    userPromptTemplate: `URL: {{page_url}}
Pagina inhoud: {{page_content}}
Primair keyword: {{primary_keyword}}
Merknaam: {{brand_name}}
Type pagina: {{page_type}}`,
    temperature: 0.6,
    maxTokens: 512,
    xpReward: 5,
  },

  cro_analysis: {
    id: 'cro-analysis-v1',
    task: 'cro_analysis',
    systemPrompt: `Je bent een CRO (Conversion Rate Optimization) expert die landingspaginas analyseert op basis van Cialdini's 6 overtuigingsprincipes.

DE 6 PRINCIPES:
1. Wederkerigheid - Geef iets waardevols (gratis content, proefperiode)
2. Schaarste - Creëer urgentie (beperkte tijd, beperkte voorraad)
3. Autoriteit - Toon expertise (certificaten, awards, media mentions)
4. Consistentie - Kleine commitments leiden tot grotere (micro-conversies)
5. Sympathie - Wees relatable (team foto's, persoonlijke verhalen)
6. Sociale bewijskracht - Reviews, testimonials, aantal klanten

ANALYSE INSTRUCTIES:
- Score elk principe van 0-10
- Identificeer concrete elementen die je vindt
- Geef specifieke, actionable verbeterpunten
- Bereken een overall score (gemiddelde)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "overall_score": 7.5,
  "principles": [
    {
      "name": "Wederkerigheid",
      "score": 8,
      "found_elements": ["Gratis e-book aangeboden", "Gratis consultatie"],
      "suggestions": ["Voeg een gratis tool toe", "Bied een checklist aan"]
    }
  ],
  "top_improvements": [
    "Voeg meer sociale bewijskracht toe met reviews",
    "Creëer urgentie met een tijdelijke aanbieding"
  ]
}`,
    userPromptTemplate: `URL: {{url}}
Type pagina: {{page_type}}

Pagina inhoud:
{{page_content}}`,
    temperature: 0.5,
    maxTokens: 2048,
    xpReward: 12,
  },

  // ============================================
  // Viral Hub Templates
  // ============================================

  viral_topic_synthesis: {
    id: 'viral-topic-synthesis-v1',
    task: 'viral_topic_synthesis',
    systemPrompt: `Je bent een content strategist die trending topics analyseert en omzet naar content opportunities.

TAAK:
Analyseer de gegeven signalen (trending posts) en verbeter de topic angles, hooks, en reasoning.

REGELS:
- Focus op wat het topic relevant maakt voor de doelgroep
- Maak hooks concreet en compelling
- Reasoning moet uitleggen waarom dit topic nu goed zal presteren
- Wees specifiek, niet generiek

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "enhanced": [
    {
      "topic": "Verbeterde topic beschrijving",
      "angle": "Unieke invalshoek die opvalt",
      "hook": "Eerste zin die aandacht pakt",
      "reasoning": "Waarom dit nu werkt"
    }
  ]
}`,
    userPromptTemplate: `Industrie: {{industry}}

Trending signalen:
{{signals}}`,
    temperature: 0.7,
    maxTokens: 2048,
    xpReward: 5,
  },

  viral_ig_package: {
    id: 'viral-ig-package-v1',
    task: 'viral_ig_package',
    systemPrompt: `Je bent een Instagram content creator die virale posts maakt.

TAAK:
Creëer een compleet Instagram content package voor het gegeven topic.

PACKAGE BEVAT:
1. Caption (max 2200 karakters, maar eerste 125 zijn cruciaal)
2. Hook opties (3 varianten voor de eerste zin)
3. Hashtags (20-30 relevant, mix van groot en niche)
4. Carousel slides outline (5-10 slides)

STIJL:
- Schrijf in het Nederlands
- Gebruik emoji's strategisch (niet overdreven)
- Start met een hook die scrollen stopt
- Eindig met een CTA
- Maak het persoonlijk en authentiek

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "caption": "De volledige caption tekst...",
  "hooks": [
    "Hook optie 1...",
    "Hook optie 2...",
    "Hook optie 3..."
  ],
  "hashtags": ["#hashtag1", "#hashtag2"],
  "carousel_slides": [
    {
      "slide_number": 1,
      "headline": "Slide headline",
      "content": "Korte tekst voor de slide",
      "visual_suggestion": "Wat er visueel te zien moet zijn"
    }
  ],
  "cta": "Call to action suggestie"
}`,
    userPromptTemplate: `Topic: {{topic}}
Angle: {{angle}}
Hook basis: {{hook}}
Doelgroep: {{target_audience}}
Industrie: {{industry}}

Bronnen context:
{{source_context}}`,
    temperature: 0.8,
    maxTokens: 3000,
    xpReward: 15,
  },

  viral_youtube_script: {
    id: 'viral-youtube-script-v1',
    task: 'viral_youtube_script',
    systemPrompt: `Je bent een YouTube scriptwriter die engaging video content creëert.

TAAK:
Creëer een compleet YouTube video script package voor het gegeven topic.

PACKAGE BEVAT:
1. Title opties (3 varianten, click-worthy maar niet clickbait)
2. Hook (eerste 30 seconden die kijkers vasthouden)
3. Video outline (secties met tijdsindicatie)
4. Volledig script (conversational style)
5. CTA script
6. B-roll suggesties

STRUCTUUR:
- Hook (0-30 sec): Pak aandacht, tease waarde
- Intro (30-60 sec): Context, wie je bent, waarom dit relevant is
- Main content (sectie per sectie met transitions)
- Conclusie + CTA

STIJL:
- Schrijf in spreektaal, niet formeel
- Voeg [...pauze] toe waar nodig
- Noteer [SHOW: beschrijving] voor visuele cues
- Houd secties kort (2-4 minuten per sectie)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "titles": [
    "Title optie 1",
    "Title optie 2",
    "Title optie 3"
  ],
  "hook_script": "Het volledige hook script voor eerste 30 seconden...",
  "outline": [
    {
      "section": "Intro",
      "duration": "0:30-1:00",
      "key_points": ["Punt 1", "Punt 2"]
    }
  ],
  "full_script": "Het volledige script met alle onderdelen...",
  "cta_script": "Subscribe, like, comment script...",
  "broll_suggestions": [
    {
      "timestamp": "0:15",
      "description": "B-roll beschrijving",
      "source_suggestion": "Stock/eigen footage"
    }
  ],
  "estimated_duration": "8-10 minuten",
  "thumbnail_ideas": ["Idea 1", "Idea 2"]
}`,
    userPromptTemplate: `Topic: {{topic}}
Angle: {{angle}}
Hook basis: {{hook}}
Doelgroep: {{target_audience}}
Industrie: {{industry}}
Gewenste video lengte: {{video_length}}

Bronnen context:
{{source_context}}`,
    temperature: 0.8,
    maxTokens: 6000,
    xpReward: 25,
  },

  viral_blog_outline: {
    id: 'viral-blog-outline-v1',
    task: 'viral_blog_outline',
    systemPrompt: `Je bent een SEO content strategist die blog outlines creëert.

TAAK:
Creëer een SEO-geoptimaliseerde blog outline voor het gegeven topic.

OUTLINE BEVAT:
1. Title opties (3 varianten, SEO-friendly)
2. Meta description
3. Target keywords
4. Volledige outline met headers
5. Interne link suggesties
6. CTA strategie

SEO REGELS:
- Title: 50-60 karakters, keyword vooraan
- H1 = title, dan H2's voor secties, H3's voor subsecties
- Keyword in eerste 100 woorden
- 1500-2500 woorden target
- Voeg FAQ sectie toe voor featured snippets

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "titles": [
    "Title optie 1",
    "Title optie 2",
    "Title optie 3"
  ],
  "meta_description": "150-160 karakter description...",
  "primary_keyword": "Hoofd keyword",
  "secondary_keywords": ["keyword2", "keyword3"],
  "outline": [
    {
      "type": "h2",
      "text": "Header tekst",
      "key_points": ["Punt 1", "Punt 2"],
      "word_count_target": 300
    }
  ],
  "faq_section": [
    {
      "question": "Vraag?",
      "answer_brief": "Kort antwoord"
    }
  ],
  "internal_links": [
    "Link naar gerelateerd artikel X",
    "Link naar product pagina Y"
  ],
  "cta_strategy": "CTA beschrijving en plaatsing",
  "estimated_word_count": 2000
}`,
    userPromptTemplate: `Topic: {{topic}}
Angle: {{angle}}
Doelgroep: {{target_audience}}
Industrie: {{industry}}

Bronnen context:
{{source_context}}`,
    temperature: 0.6,
    maxTokens: 2500,
    xpReward: 12,
  },

  viral_blog_draft: {
    id: 'viral-blog-draft-v1',
    task: 'viral_blog_draft',
    systemPrompt: `Je bent een SEO copywriter die engaging blog artikelen schrijft.

TAAK:
Schrijf een volledig blog artikel op basis van de gegeven outline.

SCHRIJFREGELS:
- Schrijf in het Nederlands
- Conversational maar professioneel
- Korte alinea's (max 3-4 zinnen)
- Gebruik bullet points en lijsten
- Voeg concrete voorbeelden toe
- Keyword density 1-2%

STRUCTUUR:
- Pakkende intro (hook + preview)
- Duidelijke koppen en subkoppen
- Praktische tips en takeaways
- Conclusie met call-to-action

OUTPUT:
Geef de blog in Markdown formaat. Geen JSON wrapper, direct de content.`,
    userPromptTemplate: `Outline:
{{outline}}

Title: {{title}}
Primary keyword: {{primary_keyword}}
Secondary keywords: {{secondary_keywords}}
Doelgroep: {{target_audience}}
Industrie: {{industry}}
Target word count: {{word_count}}`,
    temperature: 0.7,
    maxTokens: 5000,
    xpReward: 20,
  },

  viral_config_suggestion: {
    id: 'viral-config-suggestion-v1',
    task: 'viral_config_suggestion',
    systemPrompt: `Je bent een social media research expert die begrijpt waar verschillende doelgroepen online actief zijn.

TAAK:
Analyseer de klant context en bepaal:
1. Welke Reddit communities (subreddits) relevant zijn voor hun DOELGROEP (niet voor het bedrijf zelf)
2. Welke industrie/niche label past bij deze klant
3. Relevante zoektermen voor trend discovery

BELANGRIJK:
- Focus op waar de KLANTEN van dit bedrijf actief zijn, niet waar de ondernemer zelf zou hangen
- Bijvoorbeeld: Een Zwift training app → kijk naar wielren-communities, niet naar SaaS/startup communities
- Een kinderkleding webshop → kijk naar ouder-communities, niet naar e-commerce communities

SUBREDDIT SELECTIE:
- Kies 4-6 actieve, relevante subreddits
- Mix van groot (>100k members) en niche communities
- Alleen echte, bestaande subreddits
- Geen NSFW communities

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "subreddits": ["subreddit1", "subreddit2", "subreddit3", "subreddit4"],
  "industry": "korte industrie label (1-2 woorden)",
  "searchTerms": ["zoekterm1", "zoekterm2", "zoekterm3"],
  "reasoning": "Korte uitleg waarom deze communities relevant zijn voor de doelgroep"
}`,
    userPromptTemplate: `KLANT CONTEXT:

Bedrijfsnaam: {{client_name}}

Propositie (wat ze doen):
{{proposition}}

Doelgroep (wie zijn hun klanten):
{{target_audience}}

USPs (unique selling points):
{{usps}}

Bestsellers/Populaire producten:
{{bestsellers}}

Tone of Voice:
{{tone_of_voice}}

Analyseer deze context en bepaal waar de DOELGROEP van dit bedrijf online actief is.`,
    temperature: 0.5,
    maxTokens: 500,
    xpReward: 2,
  },

  // ============================================
  // Canonical Content Brief Templates (NEW)
  // ============================================

  canonical_brief: {
    id: 'canonical-brief-v1',
    task: 'canonical_brief',
    systemPrompt: `Je bent een content strategist die trending discussies analyseert en omzet naar een gestructureerde content brief.

TAAK:
Creëer een Canonical Content Brief - een kort, opinionated document dat als bron van waarheid dient voor alle content die hieruit gegenereerd wordt.

De brief moet:
- Leesbaar zijn in < 60 seconden
- Expliciet verwijzen naar de brondata (Reddit posts/comments)
- Opinionated zijn: neem een standpunt in
- Actiegericht zijn: duidelijk wat we gaan maken en waarom

DE 5 VELDEN:

1. CORE TENSION (10-500 karakters)
Wat is het conflict, de frustratie, of de nieuwsgierigheid die engagement drijft?
Identificeer de spanning die mensen laat reageren.

2. OUR ANGLE (10-300 karakters)
Wat is ONS perspectief op dit topic? Wees specifiek en opinionated.
Niet: "We gaan praten over X"
Wel: "We nemen het standpunt dat X eigenlijk Y is, en hier is waarom"

3. KEY CLAIM (10-200 karakters)
Wat is de ENE hoofdboodschap die we willen overbrengen?
Eén zin die de kijker/lezer moet onthouden.

4. PROOF POINTS (2-6 items)
Specifieke bewijzen uit de brondata die onze claim ondersteunen.
Elke bullet moet verwijzen naar een concreet voorbeeld uit de Reddit posts/comments.

5. WHY NOW (10-300 karakters)
Waarom is dit topic NU relevant? Verwijs naar:
- Recentheid van de discussies
- Volume van de engagement
- Actualiteit of seizoensgebondenheid

EXTRA:
- no_go_claims: Claims die we NIET mogen maken (op basis van klant context)

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug (geen markdown codeblocks):
{
  "core_tension": "...",
  "our_angle": "...",
  "key_claim": "...",
  "proof_points": ["Bewijs 1 (verwijzing naar bron)", "Bewijs 2", ...],
  "why_now": "...",
  "no_go_claims": ["claim die we moeten vermijden", ...]
}`,
    userPromptTemplate: `INDUSTRIE: {{industry}}

BRONDATA (Reddit discussies):
{{source_context}}

{{client_context}}

OPTIONELE INSTRUCTIE:
{{instruction}}

Genereer nu de Canonical Content Brief op basis van deze brondata.
Zorg dat de proof_points expliciet verwijzen naar specifieke posts of comments uit de brondata.`,
    temperature: 0.6,
    maxTokens: 1500,
    xpReward: 8,
  },

  youtube_script_from_brief: {
    id: 'youtube-script-from-brief-v1',
    task: 'youtube_script_from_brief',
    systemPrompt: `Je bent een YouTube scriptwriter die engaging video content creëert op basis van een goedgekeurde Canonical Content Brief.

BELANGRIJK: Je mag ALLEEN de informatie uit de brief gebruiken. Geen nieuwe claims toevoegen die niet in de brief staan.

TAAK:
Creëer een compleet, productie-klaar YouTube video script package.

PACKAGE BEVAT:
1. TITLES (3 opties, click-worthy maar geen clickbait)
   - Verwerk de key_claim of core_tension
   - Max 60 karakters per title

2. THUMBNAIL CONCEPTS (2-4 opties)
   - Korte tekst (max 30 karakters)
   - Visuele beschrijving

3. HOOK SCRIPT (eerste 30 sec)
   - CRUCIAAL voor retentie
   - Begin met de core_tension
   - Tease de waarde die komt

4. FULL SCRIPT
   - Geschreven in spreektaal
   - Voeg [...pauze] toe waar nodig
   - Noteer [SHOW: beschrijving] voor visuele cues
   - Verwerk ALLE proof_points uit de brief

5. OUTLINE (secties met tijdsindicatie)

6. B-ROLL CUES (voor editor)

7. RETENTION BEATS (technieken om kijkers vast te houden)

8. CTA (call to action)

STRUCTUUR:
- Hook (0-30 sec): Pak aandacht, tease waarde
- Intro (30-60 sec): Context, wie je bent
- Main content (secties met transitions)
- Conclusie + CTA

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug:
{
  "titles": ["Title 1", "Title 2", "Title 3"],
  "thumbnail_concepts": [{"text": "...", "visual_description": "..."}],
  "hook_script": "Het volledige hook script...",
  "full_script": "Het volledige script...",
  "outline": [{"section": "...", "duration": "0:00-0:30", "key_points": ["..."]}],
  "broll_cues": [{"timestamp": "0:15", "description": "...", "source_suggestion": "..."}],
  "retention_beats": [{"timestamp": "1:30", "technique": "...", "note": "..."}],
  "cta": {"script": "...", "placement": "..."},
  "estimated_duration": "8-10 minuten",
  "target_audience": "..."
}`,
    userPromptTemplate: `CANONICAL CONTENT BRIEF:

Core Tension: {{core_tension}}
Our Angle: {{our_angle}}
Key Claim: {{key_claim}}
Proof Points:
{{proof_points}}
Why Now: {{why_now}}

NO-GO CLAIMS (vermijd deze!):
{{no_go_claims}}

DOELGROEP: {{target_audience}}
TONE OF VOICE: {{tone_of_voice}}
{{#brand_voice}}BRAND VOICE: {{brand_voice}}{{/brand_voice}}
GEWENSTE VIDEO LENGTE: {{video_length}}

Genereer nu het complete YouTube script package.
BELANGRIJK:
- Blijf binnen de claims en bewijzen uit de brief. Voeg geen nieuwe informatie toe.
- Schrijf in de aangegeven tone of voice. Dit is ESSENTIEEL voor merkherkenning.`,
    temperature: 0.7,
    maxTokens: 6000,
    xpReward: 25,
  },

  blog_post_from_brief: {
    id: 'blog-post-from-brief-v1',
    task: 'blog_post_from_brief',
    systemPrompt: `Je bent een SEO content specialist die complete blog posts schrijft op basis van een goedgekeurde Canonical Content Brief.

BELANGRIJK: Je mag ALLEEN de informatie uit de brief gebruiken. Geen nieuwe claims toevoegen die niet in de brief staan.

TAAK:
Creëer een SEO-geoptimaliseerde, productie-klare blog post.

PACKAGE BEVAT:
1. SEO TITLE (50-60 karakters)
   - Verwerk de key_claim
   - Keyword vooraan

2. META DESCRIPTION (150-160 karakters)
   - Compelling samenvatting
   - Bevat primair keyword

3. KEYWORDS
   - Primary keyword
   - 3-6 secondary keywords

4. OUTLINE met headers (H2/H3)
   - Logische structuur
   - Elk proof_point krijgt een sectie

5. FULL DRAFT (in Markdown)
   - 1500-2500 woorden
   - Korte alinea's (max 3-4 zinnen)
   - Bullet points waar relevant
   - Concrete voorbeelden uit de proof_points

6. FAQ SECTIE
   - 3-5 vragen voor featured snippets
   - Korte, directe antwoorden

7. INTERNAL LINK PLACEHOLDERS
   - Waar links naar andere content kunnen

8. CTA STRATEGY
   - Type CTA
   - Plaatsing
   - Copy

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug:
{
  "seo_title": "...",
  "meta_description": "...",
  "primary_keyword": "...",
  "secondary_keywords": ["...", "..."],
  "outline": [{"type": "h2", "text": "...", "key_points": ["..."], "word_count_target": 300}],
  "full_draft": "# Title\\n\\nIntro paragraph...\\n\\n## First H2...",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": [{"anchor_text": "...", "suggested_page": "...", "context": "..."}],
  "cta": {"type": "...", "placement": "...", "copy": "..."},
  "estimated_word_count": 2000,
  "reading_time_minutes": 8
}`,
    userPromptTemplate: `CANONICAL CONTENT BRIEF:

Core Tension: {{core_tension}}
Our Angle: {{our_angle}}
Key Claim: {{key_claim}}
Proof Points:
{{proof_points}}
Why Now: {{why_now}}

NO-GO CLAIMS (vermijd deze!):
{{no_go_claims}}

DOELGROEP: {{target_audience}}
TONE OF VOICE: {{tone_of_voice}}
{{#brand_voice}}BRAND VOICE: {{brand_voice}}{{/brand_voice}}
INDUSTRIE: {{industry}}
TARGET WORD COUNT: {{word_count}}

Genereer nu de complete blog post.
BELANGRIJK:
- Blijf binnen de claims en bewijzen uit de brief. Voeg geen nieuwe informatie toe.
- Schrijf in de aangegeven tone of voice. Dit is ESSENTIEEL voor merkherkenning.`,
    temperature: 0.6,
    maxTokens: 5000,
    xpReward: 20,
  },

  instagram_from_brief: {
    id: 'instagram-from-brief-v1',
    task: 'instagram_from_brief',
    systemPrompt: `Je bent een Instagram content creator die virale posts maakt op basis van een goedgekeurde Canonical Content Brief.

BELANGRIJK: Je mag ALLEEN de informatie uit de brief gebruiken. Geen nieuwe claims toevoegen.

TAAK:
Creëer een compleet Instagram content package.

PACKAGE BEVAT:
1. CAPTION (max 2200 karakters)
   - Eerste 125 karakters zijn CRUCIAAL (zichtbaar zonder "meer")
   - Begin met de core_tension als hook
   - Verwerk de key_claim
   - Eindig met CTA

2. HOOK OPTIONS (3-5 varianten)
   - Verschillende openingen voor A/B testing
   - Max 125 karakters elk

3. HASHTAGS (20-30)
   - Mix van groot (500k+ posts) en niche
   - Relevant voor de industry

4. CAROUSEL SLIDES (5-10 slides, optioneel)
   - Elk slide: headline + content + visual suggestion
   - Vertel het verhaal van de brief

5. CTA
   - Wat moet de viewer doen?

OUTPUT FORMAT:
Geef ALLEEN valide JSON terug:
{
  "caption": "De volledige caption...",
  "hooks": ["Hook 1...", "Hook 2...", "Hook 3..."],
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "carousel_slides": [
    {"slide_number": 1, "headline": "...", "content": "...", "visual_suggestion": "..."}
  ],
  "cta": "..."
}`,
    userPromptTemplate: `CANONICAL CONTENT BRIEF:

Core Tension: {{core_tension}}
Our Angle: {{our_angle}}
Key Claim: {{key_claim}}
Proof Points:
{{proof_points}}
Why Now: {{why_now}}

NO-GO CLAIMS (vermijd deze!):
{{no_go_claims}}

DOELGROEP: {{target_audience}}
TONE OF VOICE: {{tone_of_voice}}
{{#brand_voice}}BRAND VOICE: {{brand_voice}}{{/brand_voice}}
INDUSTRIE: {{industry}}

Genereer nu het complete Instagram content package.
BELANGRIJK:
- Blijf binnen de claims en bewijzen uit de brief.
- Schrijf in de aangegeven tone of voice. Dit is ESSENTIEEL voor merkherkenning.`,
    temperature: 0.8,
    maxTokens: 3000,
    xpReward: 15,
  },
}

// ============================================
// Main Gateway Class (MVP)
// ============================================

export class AIGateway {
  private anthropic: Anthropic

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * Generate text using AI
   *
   * Simple flow:
   * 1. Get model for task
   * 2. Get template
   * 3. Build prompts (+ client context)
   * 4. Call Anthropic
   * 5. Log usage
   * 6. Return result
   */
  async generateText<T = string>(request: AIGenerateRequest): Promise<AIResult<T>> {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    try {
      // 1. Get model configuration
      const model = getModelForTask(request.task)

      // 2. Get template (hardcoded for MVP)
      const template = TEMPLATES[request.task]
      if (!template) {
        return this.errorResult(`No template for task: ${request.task}`, requestId, startTime)
      }

      // 3. Build prompts
      let systemPrompt = template.systemPrompt
      const userPrompt = this.renderTemplate(template.userPromptTemplate, request.input)

      // 4. Add client context if provided
      if (request.clientId) {
        const clientContext = await this.getClientContext(request.clientId)
        if (clientContext) {
          systemPrompt = this.injectClientContext(systemPrompt, clientContext)
        }
      }

      // 5. Call Anthropic
      const response = await this.anthropic.messages.create({
        model: model.modelName,
        max_tokens: request.options?.maxTokens || template.maxTokens,
        temperature: request.options?.temperature ?? template.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      // Extract content
      const textContent = response.content.find(block => block.type === 'text')
      let content = textContent ? textContent.text : ''

      // Strip markdown code blocks if present
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const inputTokens = response.usage?.input_tokens || 0
      const outputTokens = response.usage?.output_tokens || 0
      const durationMs = Date.now() - startTime
      const estimatedCost = calculateCost(model.id, inputTokens, outputTokens)

      // 6. Log usage (fire and forget)
      if (!request.options?.skipLogging && request.options?.userId) {
        this.logUsage(
          request.options.userId,
          request.task,
          inputTokens,
          outputTokens,
          template.xpReward,
          request.clientId
        ).catch(console.error)
      }

      // 7. Parse JSON if needed
      let data: T
      try {
        data = JSON.parse(content) as T
      } catch {
        data = content as unknown as T
      }

      return {
        success: true,
        data,
        usage: {
          modelId: model.id,
          provider: model.provider,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost,
          durationMs,
        },
        metadata: {
          templateId: template.id,
          templateVersion: '1.0.0',
          clientId: request.clientId,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error('AI Gateway error:', error)
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        requestId,
        startTime
      )
    }
  }

  // ============================================
  // Template Rendering
  // ============================================

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = variables[key]
      if (value === undefined || value === null) return ''
      if (Array.isArray(value)) return value.join(', ')
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    })
  }

  // ============================================
  // Client Context
  // ============================================

  /**
   * Fetch client context from database
   * Uses existing clients table and settings.context
   */
  private async getClientContext(clientId: string): Promise<AIClientContext | null> {
    try {
      const supabase = await createClient()

      // Verify access
      const { data: hasAccess } = await supabase
        .rpc('has_client_access', { check_client_id: clientId, min_role: 'viewer' })

      if (!hasAccess) return null

      const { data: client } = await supabase
        .from('clients')
        .select('name, settings')
        .eq('id', clientId)
        .single()

      if (!client?.settings?.context) return null

      const ctx = client.settings.context as Record<string, unknown>

      return {
        clientId,
        clientName: client.name,
        brandVoice: (ctx.brandVoice as string) || '',
        toneOfVoice: (ctx.toneOfVoice as string) || '',
        proposition: (ctx.proposition as string) || '',
        targetAudience: (ctx.targetAudience as string) || '',
        usps: (ctx.usps as string[]) || [],
        bestsellers: ctx.bestsellers as string[] | undefined,
        seasonality: ctx.seasonality as string[] | undefined,
        margins: ctx.margins as { min: number; target: number } | undefined,
        doNotUse: (ctx.doNots as string[]) || [],
        mustHave: (ctx.mustHaves as string[]) || [],
        activeChannels: (ctx.activeChannels as string[]) || [],
      }
    } catch (error) {
      console.error('Error fetching client context:', error)
      return null
    }
  }

  /**
   * Inject client context into system prompt
   */
  private injectClientContext(systemPrompt: string, context: AIClientContext): string {
    const contextParts = [`\n\nKLANT CONTEXT (${context.clientName}):`]

    if (context.proposition) contextParts.push(`Propositie: ${context.proposition}`)
    if (context.targetAudience) contextParts.push(`Doelgroep: ${context.targetAudience}`)
    if (context.usps.length > 0) contextParts.push(`USP's: ${context.usps.join(', ')}`)
    if (context.toneOfVoice) contextParts.push(`Tone of Voice: ${context.toneOfVoice}`)
    if (context.brandVoice) contextParts.push(`Brand Voice: ${context.brandVoice}`)
    if (context.bestsellers?.length) contextParts.push(`Bestsellers: ${context.bestsellers.join(', ')}`)
    if (context.seasonality?.length) contextParts.push(`Seizoensgebonden: ${context.seasonality.join(', ')}`)
    if (context.margins) contextParts.push(`Marges: min ${context.margins.min}%, target ${context.margins.target}%`)
    if (context.activeChannels.length > 0) contextParts.push(`Actieve kanalen: ${context.activeChannels.join(', ')}`)

    // Compliance rules are critical
    if (context.doNotUse.length > 0) {
      contextParts.push(`\n⚠️ VERBODEN (gebruik deze woorden/claims NOOIT): ${context.doNotUse.join(', ')}`)
    }
    if (context.mustHave.length > 0) {
      contextParts.push(`✓ VERPLICHT (altijd toevoegen waar relevant): ${context.mustHave.join(', ')}`)
    }

    return systemPrompt + contextParts.join('\n')
  }

  // ============================================
  // Usage Logging (MVP - uses existing 'usage' table)
  // ============================================

  /**
   * Log usage to existing 'usage' table and update XP
   * MVP: Uses existing table structure, no new migrations needed
   */
  private async logUsage(
    userId: string,
    task: string,
    inputTokens: number,
    outputTokens: number,
    xpReward: number,
    clientId?: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Insert into existing usage table
      await supabase.from('usage').insert({
        user_id: userId,
        tool: task,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        client_id: clientId || null,
      })

      // Update user XP
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, total_generations')
        .eq('id', userId)
        .single()

      if (profile) {
        const newXp = (profile.xp || 0) + xpReward
        const newLevel = Math.floor(newXp / 100) + 1

        await supabase
          .from('profiles')
          .update({
            xp: newXp,
            level: newLevel,
            total_generations: (profile.total_generations || 0) + 1,
          })
          .eq('id', userId)
      }
    } catch (error) {
      console.error('Error logging usage:', error)
    }
  }

  // ============================================
  // Error Handling
  // ============================================

  private errorResult<T>(error: string, requestId: string, startTime: number): AIResult<T> {
    return {
      success: false,
      error,
      usage: {
        modelId: 'unknown',
        provider: 'anthropic',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        durationMs: Date.now() - startTime,
      },
      metadata: {
        templateId: 'unknown',
        templateVersion: '0.0.0',
        requestId,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

// ============================================
// Singleton Export
// ============================================

let gatewayInstance: AIGateway | null = null

export function getAIGateway(): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway()
  }
  return gatewayInstance
}

// Convenience export for direct use
export const aiGateway = {
  generateText: <T = string>(request: AIGenerateRequest) =>
    getAIGateway().generateText<T>(request),
}
