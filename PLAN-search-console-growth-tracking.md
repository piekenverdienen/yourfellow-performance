# Implementatieplan: Search Console Growth & Tracking Features

## Overzicht

Dit plan beschrijft de implementatie van twee hoofdfeatures:
1. **Discover Hidden Growth Opportunities** - Vind onderbenut queries waar je al impressies voor krijgt
2. **Optimise & Track Performance** - Track impressies, clicks en mentions over tijd

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

-- Indexes
CREATE INDEX idx_scq_client ON search_console_queries(client_id);
CREATE INDEX idx_scq_watching ON search_console_queries(client_id, is_watching) WHERE is_watching = TRUE;
CREATE INDEX idx_scqh_query ON search_console_query_history(query_id);
CREATE INDEX idx_scqp_query ON search_console_query_pages(query_id);
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

### Fase 7: Growth Opportunities Dashboard

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
│   │       │   └── page.tsx          # Site-level queries view
│   │       └── opportunities/
│   │           └── page.tsx          # Growth opportunities
│   └── api/
│       └── search-console/
│           ├── queries/
│           │   ├── route.ts          # GET queries, POST filters
│           │   └── [id]/
│           │       ├── route.ts      # PATCH update query
│           │       └── history/
│           │           └── route.ts  # GET historical data
│           └── sync/
│               └── route.ts          # POST trigger sync
├── components/
│   └── seo/
│       ├── query-filters.tsx
│       ├── query-table.tsx
│       ├── query-detail-drawer.tsx
│       ├── query-metrics-chart.tsx
│       ├── date-range-picker.tsx
│       └── opportunity-card.tsx
├── services/
│   ├── search-console-sync.ts
│   └── opportunity-detector.ts
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
1. ✅ Database schema maken
2. ✅ TypeScript types
3. ✅ Sync service basis
4. ✅ API endpoint voor queries ophalen

### Sprint 2: Core UI
5. ✅ Queries pagina met data tabel
6. ✅ Filters implementeren
7. ✅ Search functionaliteit
8. ✅ Date range picker

### Sprint 3: Features
9. ✅ Watching toggle
10. ✅ Query detail drawer
11. ✅ Historical chart
12. ✅ Export functionaliteit

### Sprint 4: Intelligence
13. ✅ Query classificatie (buyer, comparison)
14. ✅ Opportunity detection
15. ✅ Opportunities dashboard

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
| API endpoints | Medium | 4 |
| Queries pagina | High | 3 |
| Filters | Medium | 1 |
| Query detail | Medium | 2 |
| Charts | Medium | 1 |
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
