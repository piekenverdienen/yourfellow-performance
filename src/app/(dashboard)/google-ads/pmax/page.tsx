'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useClientStore } from '@/stores/client-store'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssetGroupPerformance {
  id: string
  name: string
  campaignName: string
  status: string
  strength: string
  conversions: number
  conversionsValue: number
  cost: number
  clicks: number
  impressions: number
  ctr: number
  cvr: number
  roas: number
}

interface PMaxCampaign {
  id: string
  name: string
  status: string
  budgetLimited: boolean
  budget: number
  recommendedBudget: number | null
  conversions: number
  conversionsValue: number
  cost: number
  roas: number
  assetGroupCount: number
}

interface PMaxData {
  campaigns: PMaxCampaign[]
  assetGroups: AssetGroupPerformance[]
  signals: {
    budgetLimitedCampaigns: number
    lowStrengthAssetGroups: number
    topPerformingAssetGroups: AssetGroupPerformance[]
    underperformingAssetGroups: AssetGroupPerformance[]
  }
  summary: {
    totalCampaigns: number
    totalConversions: number
    totalCost: number
    totalRoas: number
  }
  accountName: string
  currency: string
}

const STRENGTH_COLORS: Record<string, string> = {
  'EXCELLENT': 'bg-green-100 text-green-800 border-green-200',
  'GOOD': 'bg-blue-100 text-blue-800 border-blue-200',
  'AVERAGE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'POOR': 'bg-red-100 text-red-800 border-red-200',
  'UNSPECIFIED': 'bg-surface-100 text-surface-600 border-surface-200',
}

const STRENGTH_LABELS: Record<string, string> = {
  'EXCELLENT': 'Uitstekend',
  'GOOD': 'Goed',
  'AVERAGE': 'Gemiddeld',
  'POOR': 'Slecht',
  'UNSPECIFIED': 'Onbekend',
}

function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

export default function PMaxAnalysisPage() {
  const { selectedClient } = useClientStore()
  const [data, setData] = useState<PMaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)

  const fetchData = async () => {
    if (!selectedClient) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/google-ads/pmax`)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch PMax data')
      }

      setData(json.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedClient])

  if (!selectedClient) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <Zap className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Selecteer een klant
            </h3>
            <p className="text-surface-600">
              Selecteer een klant om Performance Max campagnes te analyseren.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="text-center py-12 border-red-200 bg-red-50">
          <CardContent>
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Kon data niet laden
            </h3>
            <p className="text-surface-600 mb-4">{error}</p>
            <Button onClick={fetchData}>Opnieuw proberen</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data || data.campaigns.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/google-ads/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar Dashboard
            </Button>
          </Link>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <Zap className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Geen Performance Max campagnes
            </h3>
            <p className="text-surface-600">
              Dit account heeft nog geen actieve Performance Max campagnes.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/google-ads/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">
                Performance Max Analyse
              </h1>
              <p className="text-surface-600">
                {data.accountName} &bull; Laatste 7 dagen
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Vernieuwen
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-surface-500 mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Campagnes</span>
            </div>
            <p className="text-2xl font-bold text-surface-900">
              {data.summary.totalCampaigns}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-surface-500 mb-2">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">Conversies</span>
            </div>
            <p className="text-2xl font-bold text-surface-900">
              {formatNumber(data.summary.totalConversions)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-surface-500 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Uitgaven</span>
            </div>
            <p className="text-2xl font-bold text-surface-900">
              {formatCurrency(data.summary.totalCost, data.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-surface-500 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">ROAS</span>
            </div>
            <p className="text-2xl font-bold text-surface-900">
              {formatNumber(data.summary.totalRoas, 2)}x
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Signals */}
      {(data.signals.budgetLimitedCampaigns > 0 || data.signals.lowStrengthAssetGroups > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Aandachtspunten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.signals.budgetLimitedCampaigns > 0 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-surface-900">
                      {data.signals.budgetLimitedCampaigns} campagne{data.signals.budgetLimitedCampaigns > 1 ? 's' : ''} beperkt door budget
                    </p>
                    <p className="text-sm text-surface-600">
                      Deze campagnes kunnen meer conversies genereren met een hoger budget.
                    </p>
                  </div>
                </div>
              )}

              {data.signals.lowStrengthAssetGroups > 0 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-100">
                  <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-surface-900">
                      {data.signals.lowStrengthAssetGroups} asset group{data.signals.lowStrengthAssetGroups > 1 ? 's' : ''} met lage ad strength
                    </p>
                    <p className="text-sm text-surface-600">
                      Verbeter de assets om betere resultaten te behalen.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Max Campagnes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.campaigns.map((campaign) => {
              const isExpanded = expandedCampaign === campaign.id
              const campaignAssetGroups = data.assetGroups.filter(
                (ag) => ag.campaignName === campaign.name
              )

              return (
                <div
                  key={campaign.id}
                  className="border border-surface-200 rounded-xl overflow-hidden"
                >
                  {/* Campaign Header */}
                  <button
                    onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-surface-900">
                            {campaign.name}
                          </span>
                          {campaign.budgetLimited && (
                            <Badge variant="warning" className="text-xs">
                              Budget beperkt
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-surface-500">
                          {campaign.assetGroupCount} asset group{campaign.assetGroupCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Conversies</p>
                        <p className="font-semibold text-surface-900">
                          {formatNumber(campaign.conversions)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">Kosten</p>
                        <p className="font-semibold text-surface-900">
                          {formatCurrency(campaign.cost, data.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-500">ROAS</p>
                        <p className={cn(
                          'font-semibold',
                          campaign.roas >= 2 ? 'text-green-600' : campaign.roas >= 1 ? 'text-surface-900' : 'text-red-600'
                        )}>
                          {formatNumber(campaign.roas, 2)}x
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-5 w-5 text-surface-400 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-surface-200 p-4 bg-surface-50">
                      <h4 className="text-sm font-medium text-surface-700 mb-3">
                        Asset Groups
                      </h4>
                      <div className="space-y-2">
                        {campaignAssetGroups.length > 0 ? (
                          campaignAssetGroups.map((ag) => (
                            <div
                              key={ag.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-surface-100"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-surface-900">
                                  {ag.name}
                                </span>
                                <span
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded border',
                                    STRENGTH_COLORS[ag.strength] || STRENGTH_COLORS['UNSPECIFIED']
                                  )}
                                >
                                  {STRENGTH_LABELS[ag.strength] || 'Onbekend'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-surface-600">
                                  {formatNumber(ag.conversions)} conv
                                </span>
                                <span className="text-surface-600">
                                  {formatCurrency(ag.cost, data.currency)}
                                </span>
                                <span className={cn(
                                  'font-medium',
                                  ag.roas >= 2 ? 'text-green-600' : ag.roas >= 1 ? 'text-surface-900' : 'text-red-600'
                                )}>
                                  {formatNumber(ag.roas, 2)}x ROAS
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-surface-500 italic">
                            Geen asset group data beschikbaar
                          </p>
                        )}
                      </div>

                      {campaign.budgetLimited && campaign.recommendedBudget && (
                        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <div className="flex items-center gap-2 text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium">
                              Aanbevolen budget: {formatCurrency(campaign.recommendedBudget, data.currency)}/dag
                            </span>
                            <span className="text-xs text-amber-700">
                              (huidig: {formatCurrency(campaign.budget, data.currency)}/dag)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top & Underperforming Asset Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Asset Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.signals.topPerformingAssetGroups.length > 0 ? (
              <div className="space-y-2">
                {data.signals.topPerformingAssetGroups.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div>
                      <p className="font-medium text-surface-900">{ag.name}</p>
                      <p className="text-xs text-surface-500">{ag.campaignName}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-700 font-medium">
                        {formatNumber(ag.conversions)} conv
                      </span>
                      <span className="text-green-700">
                        {formatNumber(ag.roas, 2)}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500 italic">
                Geen data beschikbaar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Underperforming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Ondermaats presterende Asset Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.signals.underperformingAssetGroups.length > 0 ? (
              <div className="space-y-2">
                {data.signals.underperformingAssetGroups.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div>
                      <p className="font-medium text-surface-900">{ag.name}</p>
                      <p className="text-xs text-surface-500">{ag.campaignName}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-red-700">
                        0 conv
                      </span>
                      <span className="text-red-700">
                        {formatCurrency(ag.cost, data.currency)} spent
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">Alle asset groups presteren goed</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
