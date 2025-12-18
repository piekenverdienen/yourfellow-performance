# Implementatieplan: Search Console Growth & Tracking Features

## Overzicht

Dit plan beschrijft de implementatie van de volgende features:
1. **Discover Hidden Growth Opportunities** - Vind onderbenut queries waar je al impressies voor krijgt
2. **Optimise & Track Performance** - Track impressies, clicks en mentions over tijd
3. **Branded Keywords** - Monitor brand performance, filter branded vs non-branded queries
4. **Topic Clusters** - Groepeer gerelateerde queries voor betere analyse
5. **Content Groups** - Groepeer gerelateerde pagina's (blogs, landing pages, pSEO)

## Huidige Situatie

De bestaande Content Advisory pagina (`/seo/advisor`) is **page-focused**:
- Analyseert één specifieke pagina URL
- Haalt Search Console data op voor die ene pagina
- Geen data persistentie (alles on-demand)
- Geen historische tracking

## Gewenste Situatie (Screenshot)

Een **site-level Queries pagina** zoals QueryHunter:
- Site selector (bracefox.nl)
- Alle queries voor de hele site
- Date range picker
- Toggle filters (Watching, Has Relevant Page, On Page 2, Questions, Buyer Keywords, etc.)
- Data tabel met: Query, Pages, Mentions, Unique Impressions, Best Position, Total Clicks, Average CTR, Watching?
- Watching feature om queries te volgen

---

## Implementatie Stappen

### Fase 1: Database Schema voor Historische Data

**Nieuwe Supabase tabellen:**

```sql
-- 1. Opgeslagen Search Console queries per client
CREATE TABLE search_console_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  query TEXT NOT NULL,

  -- Aggregated metrics (laatste sync)
  unique_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  best_position DECIMAL(5,2),
  average_ctr DECIMAL(5,4),

  -- Page count
  page_count INTEGER DEFAULT 1,

  -- Query classification
  is_question BOOLEAN DEFAULT FALSE,
  is_buyer_keyword BOOLEAN DEFAULT FALSE,
  is_comparison_keyword BOOLEAN DEFAULT FALSE,
  is_branded BOOLEAN DEFAULT FALSE,       -- matched against branded_keywords

  -- Tracking
  is_watching BOOLEAN DEFAULT FALSE,
  has_relevant_page BOOLEAN DEFAULT FALSE,
  mention_count INTEGER DEFAULT 0,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, query)
);

-- 2. Historische data per query (voor trends)
CREATE TABLE search_console_query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  -- Date range
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,

  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position DECIMAL(5,2),
  ctr DECIMAL(5,4),

  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(query_id, date_start, date_end)
);

-- 3. Query-page mappings
CREATE TABLE search_console_query_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  page_url TEXT NOT NULL,

  -- Page-specific metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position DECIMAL(5,2),
  ctr DECIMAL(5,4),

  -- Content analysis
  mention_count INTEGER DEFAULT 0,
  in_title BOOLEAN DEFAULT FALSE,
  in_h1 BOOLEAN DEFAULT FALSE,
  in_h2 BOOLEAN DEFAULT FALSE,

  last_analyzed_at TIMESTAMPTZ,

  UNIQUE(query_id, page_url)
);

-- 4. Branded Keywords per client
CREATE TABLE branded_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,           -- e.g., "aurelien", "aurelien-online"
  match_type TEXT DEFAULT 'contains',  -- 'contains' (broad match), 'exact', 'starts_with'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, keyword)
);

-- 5. Topic Clusters - groepeer gerelateerde queries
CREATE TABLE topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,              -- e.g., "Hielspoor", "Kniepijn"
  description TEXT,
  color TEXT DEFAULT '#6366f1',    -- voor UI

  -- Matching rules (OR logic)
  match_keywords TEXT[],           -- e.g., ['hielspoor', 'heel spur', 'fasciitis']
  match_regex TEXT,                -- optioneel: regex pattern

  -- Aggregated metrics (berekend)
  query_count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, name)
);

-- 6. Topic Cluster Query mapping (many-to-many)
CREATE TABLE topic_cluster_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES topic_clusters(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  -- How it was matched
  matched_by TEXT,                 -- 'keyword', 'regex', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cluster_id, query_id)
);

-- 7. Content Groups - groepeer gerelateerde pagina's
CREATE TABLE content_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,              -- e.g., "Blog Posts", "Landing Pages", "pSEO Pages"
  description TEXT,
  color TEXT DEFAULT '#10b981',

  -- Matching rules (OR logic)
  url_patterns TEXT[],             -- e.g., ['/blog/*', '/artikel/*']
  url_regex TEXT,                  -- optioneel: regex pattern

  -- Aggregated metrics
  page_count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, name)
);

-- 8. Content Group Page mapping
CREATE TABLE content_group_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,

  -- Page metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,

  matched_by TEXT,                 -- 'pattern', 'regex', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(group_id, page_url)
);

-- Indexes
CREATE INDEX idx_scq_client ON search_console_queries(client_id);
CREATE INDEX idx_scq_watching ON search_console_queries(client_id, is_watching) WHERE is_watching = TRUE;
CREATE INDEX idx_scq_branded ON search_console_queries(client_id, is_branded);
CREATE INDEX idx_scqh_query ON search_console_query_history(query_id);
CREATE INDEX idx_scqp_query ON search_console_query_pages(query_id);
CREATE INDEX idx_bk_client ON branded_keywords(client_id);
CREATE INDEX idx_tc_client ON topic_clusters(client_id);
CREATE INDEX idx_tcq_cluster ON topic_cluster_queries(cluster_id);
CREATE INDEX idx_cg_client ON content_groups(client_id);
CREATE INDEX idx_cgp_group ON content_group_pages(group_id);
```

**Files aan te maken:**
- `src/lib/supabase/migrations/004_search_console_queries.sql`
- `src/types/search-console.ts` - TypeScript types

---

### Fase 2: Search Console Sync Service

**Doel:** Periodiek data ophalen van Search Console en opslaan in database

**Nieuwe files:**
- `src/services/search-console-sync.ts` - Sync service
- `src/app/api/search-console/sync/route.ts` - API endpoint voor sync

**Functionaliteit:**
```typescript
class SearchConsoleSyncService {
  // Sync alle queries voor een client
  async syncQueries(clientId: string, dateRange: { start: Date, end: Date }): Promise<SyncResult>

  // Classificeer queries (buyer, comparison, question)
  classifyQuery(query: string): QueryClassification

  // Update historische data
  async updateHistory(queryId: string, metrics: QueryMetrics): Promise<void>
}
```

**Query classificatie regels:**
- **Buyer Keywords:** Bevat "kopen", "bestellen", "prijs", "goedkoop", "beste", "vergelijk"
- **Comparison Keywords:** Bevat "vs", "versus", "of", "verschil", "vergelijken"
- **Questions:** Begint met vraagwoord of bevat "?"

---

### Fase 3: Nieuwe Queries Pagina (Site-level)

**Route:** `/seo/queries`

**Nieuwe files:**
- `src/app/(dashboard)/seo/queries/page.tsx` - Hoofdpagina
- `src/components/seo/query-filters.tsx` - Filter componenten
- `src/components/seo/query-table.tsx` - Data tabel met sorting
- `src/components/seo/date-range-picker.tsx` - Date range selector

**Features:**
1. **Site Selector** - Selecteer client/site
2. **Search** - Zoek binnen queries
3. **Date Range Picker** - 7d, 28d, 90d, custom
4. **Toggle Filters:**
   - Watching
   - Has Relevant Page
   - On Page 2 (positie 11-20)
   - Questions
   - Buyer Keywords
   - Comparison Keywords (New!)
   - No Mentions
   - Unique Impressions > 500
   - No Clicks
   - Best Position > 10
   - Best Position < 10
5. **Data Tabel:**
   - Sorteerbaar op alle kolommen
   - Query (met expand icon)
   - Pages count
   - Mentions (met icon indicator)
   - Unique Impressions
   - Best Position
   - Total Clicks
   - Average CTR
   - Watching toggle
6. **Export** - Download als CSV

---

### Fase 4: API Endpoints

**Nieuwe endpoints:**

```typescript
// GET /api/search-console/queries
// Haal alle queries op voor een client met filters
interface GetQueriesRequest {
  clientId: string
  dateStart?: string
  dateEnd?: string
  filters?: {
    watching?: boolean
    hasRelevantPage?: boolean
    isQuestion?: boolean
    isBuyerKeyword?: boolean
    isComparisonKeyword?: boolean
    noMentions?: boolean
    minImpressions?: number
    noClicks?: boolean
    positionMin?: number
    positionMax?: number
  }
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// PATCH /api/search-console/queries/[id]
// Update watching status
interface UpdateQueryRequest {
  isWatching?: boolean
}

// POST /api/search-console/sync
// Trigger sync voor client
interface SyncRequest {
  clientId: string
  dateRange?: { start: string, end: string }
}

// GET /api/search-console/queries/[id]/history
// Haal historische data op voor een query
```

---

### Fase 5: Query Detail Modal/Drawer

**Functionaliteit:**
Klik op een query om details te zien:

1. **Metrics Over Time** - Line chart met impressies/clicks trend
2. **Pages** - Alle pagina's die ranken voor deze query
3. **Content Analysis** - Mentions per pagina, title/H1/H2 presence
4. **Actions:**
   - Toggle watching
   - Open in Content Advisory (ga naar page-specifieke analyse)
   - Export data

**Nieuwe files:**
- `src/components/seo/query-detail-drawer.tsx`
- `src/components/seo/query-metrics-chart.tsx`

---

### Fase 6: Watching Feature & Notificaties

**Functionaliteit:**
- Toggle "watching" voor specifieke queries
- Filter op watched queries
- Optioneel: Email notificaties bij significante veranderingen

**Database:**
Gebruikt `is_watching` kolom in `search_console_queries`

**Future:** Notification system voor:
- Positie verbeterd/verslechterd > X posities
- Impressies stijging/daling > X%
- Query verloren (niet meer in top 100)

---

### Fase 7: Branded Keywords Settings

**Route:** `/seo/settings` (tab: Branded Keywords)

**Functionaliteit:**
- Configureer branded keywords per client
- Broad match / contains logic (e.g., "ikea" matches "ikea chair", "ikea table")
- Add/remove keywords
- Preview welke queries als branded worden gemarkeerd

**UI Components:**
```
┌─────────────────────────────────────────────────────────┐
│ Branded Keywords                              Help Guide │
├─────────────────────────────────────────────────────────┤
│ Set up branded keywords for bracefox.nl to monitor      │
│ your brand's performance in search results.             │
│                                                         │
│ We use Broad Match / Contains for these keywords.       │
│ If you add "bracefox", it will match "bracefox          │
│ zooltjes" or "bracefox review".                         │
│                                                         │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ bracefox      ✕ │  │ brace fox     ✕ │  Remove All  │
│ └─────────────────┘  └─────────────────┘               │
│                                                         │
│ [Enter a keyword...        ] [Add]                      │
└─────────────────────────────────────────────────────────┘
```

**Filter in Queries pagina:**
- "Branded" filter - toon alleen branded queries
- "Non-branded" filter - verberg branded queries (focus op organic growth)

**Nieuwe files:**
- `src/app/(dashboard)/seo/settings/page.tsx` - Settings pagina met tabs
- `src/components/seo/branded-keywords-settings.tsx`

---

### Fase 8: Topic Clusters

**Route:** `/seo/settings` (tab: Topic Clusters)

**Functionaliteit:**
- Maak topic clusters aan (bijv. "Hielspoor", "Kniepijn", "Inlegzolen")
- Definieer match keywords per cluster
- Automatische groupering van queries
- Zie aggregated metrics per cluster

**UI Components:**
```
┌─────────────────────────────────────────────────────────┐
│ Topic Clusters                                Help Guide │
├─────────────────────────────────────────────────────────┤
│ Group related queries to analyze performance            │
│ more efficiently than individual keywords.              │
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🟣 Hielspoor                           [Edit] [✕] │  │
│ │    Keywords: hielspoor, heel spur, fasciitis      │  │
│ │    42 queries · 12.4K impressions · 234 clicks    │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ 🟢 Kniepijn                            [Edit] [✕] │  │
│ │    Keywords: kniepijn, knie pijn, vocht in knie   │  │
│ │    28 queries · 8.2K impressions · 156 clicks     │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ [+ Create Topic Cluster]                                │
└─────────────────────────────────────────────────────────┘
```

**Nieuwe files:**
- `src/components/seo/topic-clusters-settings.tsx`
- `src/components/seo/topic-cluster-modal.tsx`
- `src/services/topic-cluster-matcher.ts`

---

### Fase 9: Content Groups

**Route:** `/seo/settings` (tab: Content Groups)

**Functionaliteit:**
- Groepeer pagina's op basis van URL patterns
- Voorgedefinieerde groepen: Blog Posts, Landing Pages, pSEO Pages
- Custom groepen mogelijk
- Aggregated metrics per groep

**UI Components:**
```
┌─────────────────────────────────────────────────────────┐
│ Content Groups                                Help Guide │
├─────────────────────────────────────────────────────────┤
│ Grouping related pages allows you to analyze the        │
│ performance of multiple pages much more efficiently.    │
│                                                         │
│ Common use cases: blog posts, landing pages, pSEO pages │
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 📝 Blog Posts                          [Edit] [✕] │  │
│ │    Patterns: /blog/*, /artikel/*                  │  │
│ │    86 pages · 45.2K impressions · 1.2K clicks     │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ 🎯 Landing Pages                       [Edit] [✕] │  │
│ │    Patterns: /diensten/*, /producten/*            │  │
│ │    12 pages · 18.4K impressions · 892 clicks      │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ 🔄 pSEO Pages                          [Edit] [✕] │  │
│ │    Patterns: /locatie/*, /stad/*                  │  │
│ │    234 pages · 32.1K impressions · 456 clicks     │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ [+ Create Content Group]                                │
└─────────────────────────────────────────────────────────┘
```

**Nieuwe files:**
- `src/components/seo/content-groups-settings.tsx`
- `src/components/seo/content-group-modal.tsx`
- `src/services/content-group-matcher.ts`

---

### Fase 10: Growth Opportunities Dashboard

**Route:** `/seo/opportunities`

**Automatische detectie van kansen:**

1. **Quick Wins** (Positie 4-10, veel impressies)
   - "Je staat al bijna bovenaan, kleine optimalisatie kan groot effect hebben"

2. **Page 2 Opportunities** (Positie 11-20, veel impressies)
   - "Met extra content kan je naar pagina 1"

3. **Missing Mentions** (Veel impressies, 0 mentions in content)
   - "Deze keywords missen in je content"

4. **Low CTR, Good Position** (Positie < 5, CTR < 2%)
   - "Verbeter je title/meta voor meer clicks"

5. **Buyer Intent Gaps** (Buyer keywords zonder dedicated content)
   - "Commerciële zoekwoorden waar je nog geen pagina voor hebt"

**Components:**
- `src/app/(dashboard)/seo/opportunities/page.tsx`
- `src/components/seo/opportunity-card.tsx`
- `src/services/opportunity-detector.ts`

---

## File Structuur (Nieuw)

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── seo/
│   │       ├── queries/
│   │       │   └── page.tsx              # Site-level queries view
│   │       ├── pages/
│   │       │   └── page.tsx              # Site-level pages view
│   │       ├── settings/
│   │       │   └── page.tsx              # Settings (branded, clusters, groups)
│   │       └── opportunities/
│   │           └── page.tsx              # Growth opportunities
│   └── api/
│       └── search-console/
│           ├── queries/
│           │   ├── route.ts              # GET queries, POST filters
│           │   └── [id]/
│           │       ├── route.ts          # PATCH update query
│           │       └── history/
│           │           └── route.ts      # GET historical data
│           ├── branded-keywords/
│           │   └── route.ts              # CRUD branded keywords
│           ├── topic-clusters/
│           │   ├── route.ts              # CRUD topic clusters
│           │   └── [id]/
│           │       └── route.ts          # GET/PATCH/DELETE cluster
│           ├── content-groups/
│           │   ├── route.ts              # CRUD content groups
│           │   └── [id]/
│           │       └── route.ts          # GET/PATCH/DELETE group
│           └── sync/
│               └── route.ts              # POST trigger sync
├── components/
│   └── seo/
│       ├── query-filters.tsx
│       ├── query-table.tsx
│       ├── query-detail-drawer.tsx
│       ├── query-metrics-chart.tsx
│       ├── date-range-picker.tsx
│       ├── opportunity-card.tsx
│       ├── branded-keywords-settings.tsx
│       ├── topic-clusters-settings.tsx
│       ├── topic-cluster-modal.tsx
│       ├── content-groups-settings.tsx
│       └── content-group-modal.tsx
├── services/
│   ├── search-console-sync.ts
│   ├── opportunity-detector.ts
│   ├── topic-cluster-matcher.ts
│   └── content-group-matcher.ts
├── types/
│   └── search-console.ts
└── lib/
    └── supabase/
        └── migrations/
            └── 004_search_console_queries.sql
```

---

## Prioriteit & Volgorde

### Sprint 1: Foundation
1. Database schema maken (incl. branded, clusters, groups)
2. TypeScript types
3. Sync service basis
4. API endpoints voor queries ophalen

### Sprint 2: Core UI
5. Queries pagina met data tabel
6. Filters implementeren
7. Search functionaliteit
8. Date range picker

### Sprint 3: Features
9. Watching toggle
10. Query detail drawer
11. Historical chart
12. Export functionaliteit

### Sprint 4: Settings & Intelligence
13. Branded Keywords settings pagina
14. Topic Clusters settings pagina
15. Content Groups settings pagina
16. Query classificatie (buyer, comparison, branded)
17. Opportunity detection
18. Opportunities dashboard

---

## Technische Overwegingen

### Performance
- Pagination voor queries (max 100 per request)
- Index op veelgebruikte filters
- Client-side caching met React Query
- Debounced search

### Data Sync
- Initiele sync: laatste 28 dagen
- Incrementele sync: nieuwe data toevoegen
- Rate limiting: Google API limits respecteren
- Background job: dagelijkse sync via cron

### Privacy
- Data alleen opslaan per client
- RLS policies op Supabase tabellen
- Geen PII in queries

---

## Geschatte Effort

| Onderdeel | Complexiteit | Files |
|-----------|-------------|-------|
| Database schema | Medium | 1 |
| TypeScript types | Low | 1 |
| Sync service | High | 2 |
| API endpoints | Medium | 8 |
| Queries pagina | High | 3 |
| Filters | Medium | 1 |
| Query detail | Medium | 2 |
| Charts | Medium | 1 |
| Branded Keywords | Medium | 2 |
| Topic Clusters | High | 3 |
| Content Groups | High | 3 |
| Opportunities | High | 3 |

---

## Volgende Stappen

Na goedkeuring van dit plan:
1. Database migratie uitvoeren
2. TypeScript types aanmaken
3. Sync service bouwen
4. API endpoints maken
5. Frontend components bouwen
6. Testen met echte Search Console data
