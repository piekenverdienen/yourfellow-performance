'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Upload,
  Wand2,
  Download,
} from 'lucide-react'

const plannedFeatures = [
  {
    icon: Upload,
    title: 'Feed Import',
    description: 'Upload je product feed (CSV, XML) of verbind direct met Shopify/WooCommerce.'
  },
  {
    icon: Wand2,
    title: 'AI Optimalisatie',
    description: 'Laat AI je producttitels en beschrijvingen herschrijven voor betere CTR.'
  },
  {
    icon: CheckCircle2,
    title: 'Kwaliteitscheck',
    description: 'Automatische controle op ontbrekende velden, te lange teksten en policy issues.'
  },
  {
    icon: Download,
    title: 'Export',
    description: 'Download je geoptimaliseerde feed voor Google Merchant Center.'
  },
]

export default function GoogleAdsFeedPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Back Link */}
      <Link
        href="/google-ads"
        className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar Google Ads
      </Link>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-purple-100 mb-4">
          <Database className="h-8 w-8 text-purple-600" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h1 className="text-2xl font-bold text-surface-900">Feed Management</h1>
          <Badge variant="warning">Binnenkort</Badge>
        </div>
        <p className="text-surface-600 max-w-md mx-auto">
          Optimaliseer je product feed titels en beschrijvingen voor betere performance in Google Shopping.
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card className="mb-8 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-purple-900">In ontwikkeling</span>
          </div>
          <p className="text-surface-600 mb-6">
            We werken hard aan deze feature. Binnenkort kun je hier je Google Shopping feeds
            optimaliseren met behulp van AI.
          </p>
        </CardContent>
      </Card>

      {/* Planned Features */}
      <h2 className="text-lg font-semibold text-surface-900 mb-4">Geplande functies</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {plannedFeatures.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.title} className="opacity-75">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-100">
                    <Icon className="h-5 w-5 text-surface-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-surface-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-surface-500">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
