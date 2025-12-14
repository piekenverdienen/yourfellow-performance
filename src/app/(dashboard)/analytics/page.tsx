'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Integration } from '@/types'
import {
  Send,
  Loader2,
  LineChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointer,
  Eye,
  Target,
  Link2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CachedData {
  provider: string
  totals: {
    impressions: number
    clicks: number
    cost: number
    conversions: number
  }
  campaigns: Array<{
    name: string
    status: string
    impressions: number
    clicks: number
    cost: number
    conversions: number
    ctr: number
    cpc: number
  }>
  date_range: string
}

const EXAMPLE_QUESTIONS = [
  'Wat is mijn beste campagne deze maand?',
  'Welke campagnes hebben een lage CTR?',
  'Hoeveel heb ik uitgegeven in de laatste 30 dagen?',
  'Vergelijk de kosten per conversie per campagne',
]

export default function AnalyticsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [cachedData, setCachedData] = useState<CachedData[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch integrations
      const { data: integrationsData } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('connection_status', 'connected')

      setIntegrations(integrationsData || [])

      // Fetch cached analytics data
      if (integrationsData && integrationsData.length > 0) {
        const cachedResults: CachedData[] = []

        for (const integration of integrationsData) {
          const { data: cache } = await supabase
            .from('analytics_cache')
            .select('data')
            .eq('integration_id', integration.id)
            .eq('data_type', 'campaigns')
            .order('cached_at', { ascending: false })
            .limit(1)
            .single()

          if (cache?.data) {
            cachedResults.push({
              provider: integration.provider,
              ...cache.data,
            })
          }
        }

        setCachedData(cachedResults)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      for (const integration of integrations) {
        await fetch(`/api/integrations/${integration.id}/sync`, {
          method: 'POST',
        })
      }
      await fetchData()
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSend(question?: string) {
    const q = question || input.trim()
    if (!q) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setSending(true)

    try {
      const response = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })

      const data = await response.json()

      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, er ging iets mis: ${data.error}`,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
        }])
      }
    } catch (error) {
      console.error('Query error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Er ging iets mis bij het verwerken van je vraag. Probeer het opnieuw.',
      }])
    } finally {
      setSending(false)
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('nl-NL')
  }

  function formatCurrency(num: number): string {
    return `€${num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // No integrations connected
  if (integrations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
          <p className="text-surface-600 mt-1">
            Praat met je advertentiedata
          </p>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
              <Link2 className="h-8 w-8 text-surface-400" />
            </div>
            <h2 className="text-xl font-semibold text-surface-900 mb-2">
              Geen koppelingen gevonden
            </h2>
            <p className="text-surface-600 mb-6 max-w-md mx-auto">
              Verbind je Google Ads of Meta account om te beginnen met het analyseren van je advertentiedata.
            </p>
            <Link href="/settings/integrations">
              <Button>
                <Link2 className="h-4 w-4 mr-2" />
                Ga naar Koppelingen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate totals from all providers
  const totalMetrics = cachedData.reduce(
    (acc, data) => ({
      impressions: acc.impressions + (data.totals?.impressions || 0),
      clicks: acc.clicks + (data.totals?.clicks || 0),
      cost: acc.cost + (data.totals?.cost || 0),
      conversions: acc.conversions + (data.totals?.conversions || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  )

  const avgCtr = totalMetrics.impressions > 0
    ? (totalMetrics.clicks / totalMetrics.impressions) * 100
    : 0
  const avgCpc = totalMetrics.clicks > 0
    ? totalMetrics.cost / totalMetrics.clicks
    : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
          <p className="text-surface-600 mt-1">
            Praat met je advertentiedata
          </p>
        </div>
        <div className="flex items-center gap-2">
          {integrations.map(i => (
            <Badge key={i.id} className="bg-green-100 text-green-700">
              {i.provider === 'google_ads' ? 'Google Ads' : i.provider}
            </Badge>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Sync</span>
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {cachedData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-surface-500 mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-sm">Impressies</span>
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {formatNumber(totalMetrics.impressions)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-surface-500 mb-1">
                <MousePointer className="h-4 w-4" />
                <span className="text-sm">Klikken</span>
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {formatNumber(totalMetrics.clicks)}
              </p>
              <p className="text-xs text-surface-500">
                CTR: {avgCtr.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-surface-500 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Kosten</span>
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {formatCurrency(totalMetrics.cost)}
              </p>
              <p className="text-xs text-surface-500">
                CPC: {formatCurrency(avgCpc)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-surface-500 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-sm">Conversies</span>
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {formatNumber(totalMetrics.conversions)}
              </p>
              <p className="text-xs text-surface-500">
                CPA: {totalMetrics.conversions > 0
                  ? formatCurrency(totalMetrics.cost / totalMetrics.conversions)
                  : '—'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat Interface */}
      <Card className="min-h-[500px] flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-surface-900 mb-2">
                  Stel een vraag over je data
                </h2>
                <p className="text-surface-600 mb-6 max-w-md mx-auto">
                  Vraag alles over je campagnes, kosten, conversies en meer.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-3 py-1.5 text-sm rounded-full bg-surface-100 text-surface-700 hover:bg-surface-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-surface-900'
                        : 'bg-surface-100 text-surface-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-surface-100 rounded-2xl px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-surface-200 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Stel een vraag over je advertentiedata..."
                className="flex-1 px-4 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
