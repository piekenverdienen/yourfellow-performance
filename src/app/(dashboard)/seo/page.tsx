'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Tags,
  ChevronRight,
  Sparkles,
  Search,
  Code2,
  TrendingUp,
  Settings,
  Layers,
  SearchCheck,
  LayoutDashboard,
  Eye,
  MousePointerClick,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSelectedClient } from '@/stores/client-store'

// Pillar definitions
const pillars = [
  {
    id: 'content',
    name: 'Content',
    description: 'Optimaliseer en creëer content die rankt',
    icon: FileText,
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    items: [
      { name: 'Content Advisor', href: '/seo/advisor', description: 'AI analyse per pagina' },
      { name: 'Content Creatie', href: '/seo/content', description: 'Schrijf SEO content' },
      { name: 'Meta Tags', href: '/seo/meta', description: 'Titles & descriptions' },
    ],
  },
  {
    id: 'techniek',
    name: 'Techniek',
    description: 'Technische SEO & structured data',
    icon: Code2,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    items: [
      { name: 'Search Console', href: '/seo/queries', description: 'Query performance data' },
      { name: 'Schema Markup', href: '/seo/schema', description: 'JSON-LD generator' },
    ],
  },
  {
    id: 'autoriteit',
    name: 'Autoriteit',
    description: 'Bouw topical authority op',
    icon: Layers,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    items: [
      { name: 'Topical Authority', href: '/seo/clusters', description: 'Cluster analyse & roadmap' },
    ],
  },
]

export default function SEODashboard() {
  const selectedClient = useSelectedClient()
  const clientId = selectedClient?.id
  const [metrics, setMetrics] = useState<{
    totalQueries: number
    totalImpressions: number
    totalClicks: number
    clusterCount: number
  } | null>(null)

  // Fetch basic metrics
  useEffect(() => {
    if (!clientId) return

    async function fetchMetrics() {
      try {
        const [clustersRes] = await Promise.all([
          fetch(`/api/search-console/topic-clusters?clientId=${clientId}`),
        ])

        const clustersData = await clustersRes.json()
        const clusters = clustersData.clusters || []

        const totalQueries = clusters.reduce((sum: number, c: { queryCount: number }) => sum + c.queryCount, 0)
        const totalImpressions = clusters.reduce((sum: number, c: { totalImpressions: number }) => sum + c.totalImpressions, 0)
        const totalClicks = clusters.reduce((sum: number, c: { totalClicks: number }) => sum + c.totalClicks, 0)

        setMetrics({
          totalQueries,
          totalImpressions,
          totalClicks,
          clusterCount: clusters.length,
        })
      } catch {
        // Silently fail
      }
    }

    fetchMetrics()
  }, [clientId])

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
              <Search className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">SEO Dashboard</h1>
              {selectedClient && (
                <p className="text-surface-500 text-sm">{selectedClient.name}</p>
              )}
            </div>
          </div>
          <p className="text-surface-600 mt-1">
            Overzicht van Content, Techniek & Autoriteit
          </p>
        </div>
        <Link href="/seo/settings">
          <Button variant="outline" leftIcon={<Settings className="h-4 w-4" />}>
            Instellingen
          </Button>
        </Link>
      </div>

      {/* Quick Stats (if data available) */}
      {metrics && metrics.totalQueries > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100">
                  <SearchCheck className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Queries</p>
                  <p className="text-lg font-bold text-surface-900">{metrics.totalQueries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Eye className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Impressies</p>
                  <p className="text-lg font-bold text-surface-900">{formatNumber(metrics.totalImpressions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <MousePointerClick className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Clicks</p>
                  <p className="text-lg font-bold text-surface-900">{formatNumber(metrics.totalClicks)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Layers className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Clusters</p>
                  <p className="text-lg font-bold text-surface-900">{metrics.clusterCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No client selected warning */}
      {!selectedClient && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <p className="text-sm text-orange-800">
                Selecteer een client om SEO data te bekijken
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three Pillars */}
      <div className="grid grid-cols-3 gap-6">
        {pillars.map((pillar) => {
          const Icon = pillar.icon
          return (
            <Card key={pillar.id} className="overflow-hidden">
              <div className={cn('h-2 bg-gradient-to-r', pillar.color)} />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', pillar.bgColor)}>
                    <Icon className={cn('h-5 w-5', pillar.textColor)} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{pillar.name}</CardTitle>
                    <CardDescription className="text-xs">{pillar.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {pillar.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between p-3 rounded-lg border border-surface-200 hover:border-surface-300 hover:bg-surface-50 transition-colors group"
                    >
                      <div>
                        <p className="font-medium text-surface-900 text-sm group-hover:text-primary transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-surface-500">{item.description}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-surface-400 group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Start Guide */}
      <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-teal-100">
              <Sparkles className="h-5 w-5 text-teal-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900 mb-2">Aan de slag met SEO</h3>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-teal-200 text-teal-700 flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Instellingen</p>
                    <p className="text-xs text-surface-600">Voeg branded keywords en topic clusters toe</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-teal-200 text-teal-700 flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Search Console</p>
                    <p className="text-xs text-surface-600">Sync je data en bekijk query performance</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-teal-200 text-teal-700 flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">Analyseer</p>
                    <p className="text-xs text-surface-600">Gebruik de AI-analyse voor optimalisaties</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Utility
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
