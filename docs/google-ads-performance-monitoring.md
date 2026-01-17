# Google Ads Performance Monitoring System

This document explains the extended Google Ads monitoring system, including new performance alerts, prioritization scoring, and search hygiene checks.

## Overview

The monitoring system now includes three phases of enhancements:

1. **Phase 1: Performance Alerts** - KPI-based detection for CPA, ROAS, and spend efficiency
2. **Phase 2: Prioritization** - Impact/effort/urgency scoring to help media buyers focus
3. **Phase 3: Search Hygiene** - Automated search term waste detection

---

## Phase 1: Performance Alerts

### CPA Increase Check (`cpa_increase`)

**Why it triggers:**
- CPA (Cost Per Acquisition) has increased by 20%+ (warning) or 40%+ (critical) compared to the previous 7-day period
- Requires at least 5 conversions in both periods for statistical significance

**What this means:**
- You're paying more per conversion than before
- Could indicate: increased competition, quality score drops, audience fatigue, or bid strategy issues

**How a media buyer should act:**

1. **Immediate (within 24 hours):**
   - Open Google Ads and navigate to Campaigns > sort by CPA change
   - Identify which campaigns/ad groups show the largest CPA increases
   - Check the Change History for recent bid, budget, or targeting changes

2. **Investigation (same day):**
   - Review Quality Scores for affected keywords (QS < 6 needs attention)
   - Check Auction Insights for increased competition
   - Verify landing pages are loading correctly
   - Look at device/location/time breakdown for anomalies

3. **Actions to consider:**
   - Pause or reduce bids on keywords with dramatically higher CPA
   - Shift budget to campaigns/ad groups maintaining target CPA
   - Review and update ad copy if CTR has dropped
   - Test new landing page variants if conversion rate dropped

**Example response:**
```json
{
  "title": "Google Ads: kritieke CPA stijging",
  "shortDescription": "CPA +45% t.o.v. vorige week (€12.50 vs €8.62)",
  "impact": "Je betaalt nu €3.88 meer per conversie...",
  "severity": "critical",
  "details": {
    "currentCpa": 12.50,
    "previousCpa": 8.62,
    "cpaChangePercent": 45,
    "conversions": 34
  }
}
```

---

### ROAS Decrease Check (`roas_decrease`)

**Why it triggers:**
- ROAS (Return on Ad Spend) has decreased by 20%+ (warning) or 35%+ (critical)
- Only triggers for accounts tracking conversion value (e-commerce/lead value)
- Requires at least €50 spend and €100 conversion value

**What this means:**
- Each euro spent on ads generates less revenue than before
- Direct impact on profitability and marketing ROI

**How a media buyer should act:**

1. **Immediate:**
   - Calculate actual profit margin impact: `(Old ROAS - New ROAS) × Daily Spend`
   - Check if the drop is account-wide or specific to certain campaigns

2. **Investigation:**
   - Review product/service performance in Shopping or catalog
   - Check for stock issues, price changes, or website problems
   - Analyze conversion lag (especially for longer sales cycles)
   - Verify conversion tracking is recording value correctly

3. **Actions to consider:**
   - Reduce budgets on campaigns with ROAS below profitability threshold
   - Increase bids on products/services maintaining good ROAS
   - Review bidding strategy targets (tROAS may need adjustment)
   - Consider seasonal factors before making major changes

**Example response:**
```json
{
  "title": "Google Ads: ROAS daling",
  "shortDescription": "ROAS -28% t.o.v. vorige week (3.2 vs 4.4)",
  "impact": "Je verliest €1.20 aan rendement per uitgegeven euro...",
  "severity": "high",
  "details": {
    "currentRoas": 3.2,
    "previousRoas": 4.4,
    "lostRevenue": 580
  }
}
```

---

### Spend Without Value Check (`spend_without_value`)

**Why it triggers:**
- Ad spend increased by 30%+ (warning) or 50%+ (critical)
- But conversions/revenue did not grow proportionally (within 10% tolerance)
- Minimum €100 spend in both periods required

**What this means:**
- You're spending more money but not getting proportionally more results
- Indicates inefficient scaling or budget waste
- The "extra" spend is likely going to low-value traffic

**How a media buyer should act:**

1. **Immediate (urgent!):**
   - STOP any active scaling or budget increases
   - Identify which campaigns received the additional budget
   - Check if automated bidding is overspending

2. **Investigation:**
   - Review new audiences, keywords, or targeting added recently
   - Check Search Terms report for irrelevant queries
   - Analyze if Display/Video campaigns are overspending
   - Look for bid strategy changes or ROAS/CPA target loosening

3. **Actions to consider:**
   - Roll back recent budget increases until efficiency is restored
   - Add budget caps or daily limits to prevent runaway spend
   - Implement stricter negative keywords
   - Consider manual CPC for testing phases before scaling

**Example response:**
```json
{
  "title": "Google Ads: ernstige budgetverspilling",
  "shortDescription": "Uitgaven +60%, resultaat slechts +8%",
  "impact": "Je uitgaven zijn met €450 gestegen maar resultaten groeiden slechts 8%...",
  "severity": "critical",
  "details": {
    "spendChangePercent": 60,
    "conversionChangePercent": 8,
    "wastedSpendEstimate": 380
  }
}
```

---

## Phase 2: Prioritization System

### Understanding Priority Score

Each insight now includes prioritization fields to help you focus on what matters most:

| Field | Values | Meaning |
|-------|--------|---------|
| `impact` | low / medium / high | How much this affects your results |
| `effort` | low / medium / high | How much work to implement the fix |
| `urgency` | low / medium / high | Time-sensitivity (is it getting worse?) |
| `priority_score` | 0.33 - 9.0 | Calculated: (impact × urgency) ÷ effort |

### Priority Score Calculation

```
priority_score = (impact_weight × urgency_weight) / effort_weight

Weights:
- low = 1
- medium = 2
- high = 3
```

### Priority Score Guide

| Score Range | Example Combination | Action |
|-------------|---------------------|--------|
| **7.0 - 9.0** | High impact, high urgency, low effort | **Do this NOW** - Quick wins with major impact |
| **4.0 - 6.0** | High impact, medium urgency, medium effort | **This week** - Important but requires some work |
| **2.0 - 3.9** | Medium impact, medium urgency, medium effort | **Schedule** - Plan for when you have time |
| **1.0 - 1.9** | Low impact, any urgency, high effort | **Backlog** - Do when everything else is done |
| **< 1.0** | Low impact, low urgency, high effort | **Consider skipping** - Poor ROI on your time |

### Example Priority Scores

| Insight | Impact | Urgency | Effort | Score | Why |
|---------|--------|---------|--------|-------|-----|
| Zero conversions campaign wasting €500 | High | High | Low (pause it) | **9.0** | Stop the bleeding with one click |
| CPA +40% with budget limitation | High | High | Low (budget change) | **9.0** | Quick fix, significant impact |
| ROAS drop in major campaign | High | High | Medium (analysis needed) | **4.5** | Important but needs investigation |
| Impression share lost to rank | Medium | Medium | Medium (bid/QS work) | **2.0** | Ongoing issue, gradual fix |

---

## Phase 3: Search Hygiene

### Search Term Waste Check (`search_term_waste`)

**Why it triggers:**
- Search terms with €10+ spend and 10+ clicks but zero conversions
- Looks at the last 30 days of search term data
- Warning at €100 total waste, critical at €500+

**What this means:**
- You're paying for clicks from irrelevant searches
- Your negative keyword list needs attention
- Match types may be too broad

**How a media buyer should act:**

1. **Review the suggested negative keywords:**
   - The check returns specific negative keyword suggestions
   - Format: `"phrase match"` or `[exact match]`

2. **Add negatives strategically:**
   - Add account-level negatives for universally irrelevant terms
   - Add campaign-level negatives for context-specific terms
   - Consider phrase vs exact match based on the term

3. **Improve keyword hygiene:**
   - Schedule weekly search term reviews
   - Consider switching broad match to phrase match for high-spend keywords
   - Use shared negative keyword lists across campaigns

**Example response:**
```json
{
  "title": "Google Ads: significante zoekterm verspilling",
  "shortDescription": "€650 verspild aan 23 zoektermen zonder conversies (30 dagen)",
  "suggestedActions": [
    "Voeg de volgende negatieve zoekwoorden toe: \"gratis\", \"vacature\", [specifieke zoekterm]",
    "Bekijk je zoektermenrapport in Google Ads voor de volledige lijst"
  ],
  "details": {
    "wastedTerms": [
      {"searchTerm": "gratis product x", "cost": 45, "clicks": 28},
      {"searchTerm": "product x vacature", "cost": 38, "clicks": 22}
    ],
    "totalWaste": 650,
    "suggestedNegatives": ["\"gratis\"", "\"vacature\"", "[gratis product x]"]
  }
}
```

---

## API Response Examples

### Alert Response (Performance Type)

```typescript
{
  id: "uuid",
  client_id: "uuid",
  type: "performance",  // NEW: type = 'performance' for these checks
  channel: "google_ads",
  check_id: "cpa_increase",
  severity: "critical" | "high" | "medium" | "low",
  status: "open",
  title: "Google Ads: kritieke CPA stijging",
  short_description: "CPA +45% t.o.v. vorige week",
  impact: "Je betaalt nu €3.88 meer per conversie...",
  suggested_actions: [
    "Analyseer welke campagnes/ad groups de grootste CPA-stijging tonen",
    "Controleer of er kwaliteitsscores zijn gedaald"
  ],
  details: {
    currentPeriod: { conversions: 34, cost: 425, cpa: 12.50 },
    previousPeriod: { conversions: 38, cost: 328, cpa: 8.62 },
    cpaChangePercent: 45
  },
  fingerprint: "cpa_increase:2026-01-17",
  detected_at: "2026-01-17T09:30:00Z"
}
```

### Insight Response (With Prioritization)

```typescript
{
  id: "uuid",
  client_id: "uuid",
  rule_id: "cpa_increase_with_budget_limit",
  type: "budget",
  scope: "account",

  // Impact & Confidence
  impact: "high",
  confidence: "high",

  // NEW: Prioritization fields
  effort: "low",
  urgency: "high",
  priority_score: 9.0,  // (3 × 3) / 1

  summary: "CPA +35% terwijl budget beperkt",
  explanation: "De CPA is gestegen met 35% t.o.v. de vorige periode...",
  recommendation: "Verhoog het dagbudget met 10-20%...",

  status: "new",
  data_snapshot: {
    cpa: 18.50,
    previousCpa: 13.70,
    impressionShareLostBudget: 22
  },

  detected_at: "2026-01-17T09:30:00Z",
  expires_at: "2026-01-24T09:30:00Z"
}
```

---

## Implementation Notes

### No Automatic Changes
All checks are **observation-only**. The system will never:
- Pause campaigns automatically
- Change bids or budgets
- Add negative keywords
- Modify any Google Ads settings

All actions require manual intervention by a media buyer.

### Rule-Based Logic Only
All detection is based on explicit, deterministic rules:
- Fixed percentage thresholds (configurable)
- Time-period comparisons (7 days vs previous 7 days)
- Statistical significance requirements (min conversions, min spend)

No machine learning or black-box algorithms are used.

### Deduplication
Each check creates one alert per day per client using fingerprints:
- Format: `{check_id}:{YYYY-MM-DD}`
- Example: `cpa_increase:2026-01-17`

### Severity Guidelines

| Severity | When Used | Response Time |
|----------|-----------|---------------|
| `critical` | Active revenue loss, system broken | Same day |
| `high` | Significant performance decline | 1-2 days |
| `medium` | Notable trend, optimization opportunity | This week |
| `low` | Minor issue, good-to-know | When convenient |

---

## Files Changed

### New Check Files
- `src/monitoring/checks/google-ads/cpa-increase.ts`
- `src/monitoring/checks/google-ads/roas-decrease.ts`
- `src/monitoring/checks/google-ads/spend-without-value.ts`
- `src/monitoring/checks/google-ads/search-term-waste.ts`

### Updated Files
- `src/monitoring/checks/google-ads/index.ts` - Register new checks
- `src/monitoring/insights/insight-engine.ts` - Added effort/urgency/priority_score
- `src/types/index.ts` - Added InsightEffort, InsightUrgency types

### New Migration
- `supabase/migrations/20260117_insights_prioritization.sql` - Added effort, urgency, priority_score columns
