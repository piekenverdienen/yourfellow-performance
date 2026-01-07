/**
 * Test script voor Top Ads API
 *
 * Run met: npx tsx scripts/test-top-ads.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000'

// Vul hier je test data in:
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || '<vul-client-uuid-in>'

async function testTopAds() {
  console.log('🔍 Testing Top Ads API...\n')

  const params = new URLSearchParams({
    clientId: TEST_CLIENT_ID,
    rangeDays: '14',
    metric: 'roas',
    limit: '10',
  })

  const url = `${API_BASE}/api/meta-ads/top-ads?${params}`
  console.log(`📡 GET ${url}\n`)

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Voeg hier auth header toe indien nodig
        // 'Authorization': `Bearer ${token}`
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Error:', response.status, error)
      return
    }

    const data = await response.json()

    console.log('✅ Response:')
    console.log(`   Range: ${data.rangeDays} dagen`)
    console.log(`   Metric: ${data.metric}`)
    console.log(`   Aantal ads: ${data.items.length}\n`)

    if (data.items.length > 0) {
      console.log('🏆 Top 5 Ads:')
      console.log('─'.repeat(60))

      data.items.slice(0, 5).forEach((ad: any, i: number) => {
        console.log(`\n${i + 1}. ${ad.ad_name}`)
        console.log(`   💰 Spend: €${ad.spend.toFixed(2)}`)
        console.log(`   📈 ROAS: ${ad.roas.toFixed(2)}x`)
        console.log(`   🎯 Conversies: ${ad.conversions} (CPA: €${ad.cpa.toFixed(2)})`)
        console.log(`   👆 CTR: ${ad.ctr.toFixed(2)}%`)

        if (ad.creative) {
          console.log(`   📝 Creative:`)
          if (ad.creative.title) console.log(`      Title: ${ad.creative.title}`)
          if (ad.creative.body) console.log(`      Body: ${ad.creative.body.substring(0, 50)}...`)
          if (ad.creative.cta_type) console.log(`      CTA: ${ad.creative.cta_type}`)
        }
      })
    } else {
      console.log('⚠️  Geen ads gevonden voor deze periode')
    }

  } catch (error) {
    console.error('❌ Fetch error:', error)
  }
}

testTopAds()
