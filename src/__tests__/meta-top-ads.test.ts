import { describe, it, expect } from 'vitest'

// ============================================
// Top Ads Aggregation Tests
// ============================================

describe('Meta Top Ads - Aggregation Functions', () => {
  // Simulate the aggregation logic from the API
  function aggregateAdMetrics(rows: Array<{
    entity_id: string
    entity_name: string
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversion_value: number
  }>): Map<string, {
    ad_id: string
    ad_name: string
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversion_value: number
  }> {
    const aggregates = new Map<string, {
      ad_id: string
      ad_name: string
      spend: number
      impressions: number
      clicks: number
      conversions: number
      conversion_value: number
    }>()

    for (const row of rows) {
      const existing = aggregates.get(row.entity_id)
      if (existing) {
        existing.spend += row.spend || 0
        existing.impressions += row.impressions || 0
        existing.clicks += row.clicks || 0
        existing.conversions += row.conversions || 0
        existing.conversion_value += row.conversion_value || 0
      } else {
        aggregates.set(row.entity_id, {
          ad_id: row.entity_id,
          ad_name: row.entity_name,
          spend: row.spend || 0,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          conversion_value: row.conversion_value || 0,
        })
      }
    }

    return aggregates
  }

  describe('aggregateAdMetrics', () => {
    it('should aggregate metrics for the same ad across multiple days', () => {
      const rows = [
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 100, impressions: 1000, clicks: 50, conversions: 5, conversion_value: 500 },
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 150, impressions: 1500, clicks: 75, conversions: 8, conversion_value: 800 },
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 200, impressions: 2000, clicks: 100, conversions: 10, conversion_value: 1000 },
      ]

      const aggregates = aggregateAdMetrics(rows)
      const ad1 = aggregates.get('ad_1')

      expect(ad1).toBeDefined()
      expect(ad1!.spend).toBe(450) // 100 + 150 + 200
      expect(ad1!.impressions).toBe(4500) // 1000 + 1500 + 2000
      expect(ad1!.clicks).toBe(225) // 50 + 75 + 100
      expect(ad1!.conversions).toBe(23) // 5 + 8 + 10
      expect(ad1!.conversion_value).toBe(2300) // 500 + 800 + 1000
    })

    it('should handle multiple different ads', () => {
      const rows = [
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 100, impressions: 1000, clicks: 50, conversions: 5, conversion_value: 500 },
        { entity_id: 'ad_2', entity_name: 'Ad 2', spend: 200, impressions: 2000, clicks: 100, conversions: 10, conversion_value: 1000 },
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 100, impressions: 1000, clicks: 50, conversions: 5, conversion_value: 500 },
      ]

      const aggregates = aggregateAdMetrics(rows)

      expect(aggregates.size).toBe(2)
      expect(aggregates.get('ad_1')!.spend).toBe(200)
      expect(aggregates.get('ad_2')!.spend).toBe(200)
    })

    it('should handle empty input', () => {
      const aggregates = aggregateAdMetrics([])
      expect(aggregates.size).toBe(0)
    })

    it('should handle null/undefined values gracefully', () => {
      const rows = [
        { entity_id: 'ad_1', entity_name: 'Ad 1', spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 },
      ]

      const aggregates = aggregateAdMetrics(rows)
      const ad1 = aggregates.get('ad_1')

      expect(ad1).toBeDefined()
      expect(ad1!.spend).toBe(0)
    })
  })
})

// ============================================
// Derived Metrics Tests
// ============================================

describe('Meta Top Ads - Derived Metrics', () => {
  function calculateDerivedMetrics(ad: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversion_value: number
  }) {
    return {
      roas: ad.spend > 0 ? ad.conversion_value / ad.spend : 0,
      cpa: ad.conversions > 0 ? ad.spend / ad.conversions : 0,
      ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
      cpc: ad.clicks > 0 ? ad.spend / ad.clicks : 0,
    }
  }

  describe('ROAS calculation', () => {
    it('should calculate ROAS correctly', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        conversion_value: 500,
      })

      expect(metrics.roas).toBe(5) // 500 / 100 = 5x
    })

    it('should return 0 ROAS when spend is 0', () => {
      const metrics = calculateDerivedMetrics({
        spend: 0,
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        conversion_value: 500,
      })

      expect(metrics.roas).toBe(0)
    })
  })

  describe('CPA calculation', () => {
    it('should calculate CPA correctly', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        conversion_value: 500,
      })

      expect(metrics.cpa).toBe(10) // 100 / 10 = €10 per conversion
    })

    it('should return 0 CPA when no conversions (guard against divide by zero)', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 0,
        conversion_value: 0,
      })

      expect(metrics.cpa).toBe(0)
    })
  })

  describe('CTR calculation', () => {
    it('should calculate CTR as percentage', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        conversion_value: 500,
      })

      expect(metrics.ctr).toBe(5) // (50 / 1000) * 100 = 5%
    })

    it('should return 0 CTR when no impressions', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
      })

      expect(metrics.ctr).toBe(0)
    })
  })

  describe('CPC calculation', () => {
    it('should calculate CPC correctly', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        conversion_value: 500,
      })

      expect(metrics.cpc).toBe(2) // 100 / 50 = €2 per click
    })

    it('should return 0 CPC when no clicks', () => {
      const metrics = calculateDerivedMetrics({
        spend: 100,
        impressions: 1000,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
      })

      expect(metrics.cpc).toBe(0)
    })
  })
})

// ============================================
// Sorting Tests
// ============================================

describe('Meta Top Ads - Sorting', () => {
  type SortMetric = 'roas' | 'cpa' | 'spend' | 'conversions'

  interface AdWithMetrics {
    ad_id: string
    spend: number
    conversions: number
    conversion_value: number
    roas: number
    cpa: number
  }

  function sortAds(ads: AdWithMetrics[], metric: SortMetric): AdWithMetrics[] {
    return [...ads].sort((a, b) => {
      switch (metric) {
        case 'roas':
          return b.roas - a.roas // Higher is better
        case 'cpa':
          // Lower is better, filter out no conversions
          if (a.conversions === 0 && b.conversions === 0) return 0
          if (a.conversions === 0) return 1
          if (b.conversions === 0) return -1
          return a.cpa - b.cpa
        case 'spend':
          return b.spend - a.spend // Higher first
        case 'conversions':
          return b.conversions - a.conversions // More first
        default:
          return b.roas - a.roas
      }
    })
  }

  const testAds: AdWithMetrics[] = [
    { ad_id: 'ad_1', spend: 100, conversions: 10, conversion_value: 500, roas: 5, cpa: 10 },
    { ad_id: 'ad_2', spend: 200, conversions: 5, conversion_value: 600, roas: 3, cpa: 40 },
    { ad_id: 'ad_3', spend: 50, conversions: 8, conversion_value: 400, roas: 8, cpa: 6.25 },
    { ad_id: 'ad_4', spend: 150, conversions: 0, conversion_value: 0, roas: 0, cpa: 0 },
  ]

  it('should sort by ROAS (highest first)', () => {
    const sorted = sortAds(testAds, 'roas')

    expect(sorted[0].ad_id).toBe('ad_3') // ROAS 8
    expect(sorted[1].ad_id).toBe('ad_1') // ROAS 5
    expect(sorted[2].ad_id).toBe('ad_2') // ROAS 3
  })

  it('should sort by CPA (lowest first, exclude zero conversions)', () => {
    const sorted = sortAds(testAds, 'cpa')

    expect(sorted[0].ad_id).toBe('ad_3') // CPA 6.25
    expect(sorted[1].ad_id).toBe('ad_1') // CPA 10
    expect(sorted[2].ad_id).toBe('ad_2') // CPA 40
    expect(sorted[3].ad_id).toBe('ad_4') // No conversions (pushed to end)
  })

  it('should sort by spend (highest first)', () => {
    const sorted = sortAds(testAds, 'spend')

    expect(sorted[0].ad_id).toBe('ad_2') // Spend 200
    expect(sorted[1].ad_id).toBe('ad_4') // Spend 150
    expect(sorted[2].ad_id).toBe('ad_1') // Spend 100
    expect(sorted[3].ad_id).toBe('ad_3') // Spend 50
  })

  it('should sort by conversions (highest first)', () => {
    const sorted = sortAds(testAds, 'conversions')

    expect(sorted[0].ad_id).toBe('ad_1') // 10 conversions
    expect(sorted[1].ad_id).toBe('ad_3') // 8 conversions
    expect(sorted[2].ad_id).toBe('ad_2') // 5 conversions
    expect(sorted[3].ad_id).toBe('ad_4') // 0 conversions
  })
})

// ============================================
// Creative Join Tests
// ============================================

describe('Meta Top Ads - Creative Join', () => {
  interface Creative {
    ad_id: string
    title?: string
    body?: string
    cta_type?: string
    image_url?: string
  }

  interface AdResult {
    ad_id: string
    ad_name: string
    roas: number
    creative?: Partial<Creative>
  }

  function joinCreatives(
    ads: Array<{ ad_id: string; ad_name: string; roas: number }>,
    creatives: Creative[]
  ): AdResult[] {
    const creativesMap = new Map<string, Creative>()
    for (const c of creatives) {
      creativesMap.set(c.ad_id, c)
    }

    return ads.map(ad => ({
      ...ad,
      creative: creativesMap.get(ad.ad_id) || undefined,
    }))
  }

  it('should join creatives with matching ads', () => {
    const ads = [
      { ad_id: 'ad_1', ad_name: 'Ad 1', roas: 5 },
      { ad_id: 'ad_2', ad_name: 'Ad 2', roas: 3 },
    ]
    const creatives = [
      { ad_id: 'ad_1', title: 'Great Product', body: 'Buy now!', cta_type: 'SHOP_NOW', image_url: 'https://example.com/img1.jpg' },
      { ad_id: 'ad_2', title: 'Amazing Deal', body: 'Limited time', cta_type: 'LEARN_MORE' },
    ]

    const result = joinCreatives(ads, creatives)

    expect(result[0].creative).toBeDefined()
    expect(result[0].creative!.title).toBe('Great Product')
    expect(result[0].creative!.cta_type).toBe('SHOP_NOW')

    expect(result[1].creative).toBeDefined()
    expect(result[1].creative!.title).toBe('Amazing Deal')
  })

  it('should handle ads without creatives', () => {
    const ads = [
      { ad_id: 'ad_1', ad_name: 'Ad 1', roas: 5 },
      { ad_id: 'ad_2', ad_name: 'Ad 2', roas: 3 },
    ]
    const creatives = [
      { ad_id: 'ad_1', title: 'Great Product', body: 'Buy now!' },
    ]

    const result = joinCreatives(ads, creatives)

    expect(result[0].creative).toBeDefined()
    expect(result[1].creative).toBeUndefined()
  })

  it('should handle empty creatives array', () => {
    const ads = [
      { ad_id: 'ad_1', ad_name: 'Ad 1', roas: 5 },
    ]

    const result = joinCreatives(ads, [])

    expect(result[0].creative).toBeUndefined()
  })
})
