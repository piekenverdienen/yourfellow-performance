'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Image,
  ArrowLeft,
  Sparkles,
  Layers,
  Palette,
  Ratio,
  Download,
} from 'lucide-react'

const plannedFeatures = [
  {
    icon: Sparkles,
    title: 'AI Image Generation',
    description: 'Genereer unieke productafbeeldingen met AI op basis van je productnaam en beschrijving.'
  },
  {
    icon: Layers,
    title: 'Variaties',
    description: 'Maak meerdere variaties van dezelfde afbeelding voor A/B testing.'
  },
  {
    icon: Ratio,
    title: 'Juiste Formaten',
    description: 'Automatisch gegenereerd in alle formaten voor Display en Performance Max.'
  },
  {
    icon: Palette,
    title: 'Brand Consistency',
    description: 'Upload je brand guidelines voor consistente kleuren en stijl.'
  },
]

export default function GoogleAdsImagesPage() {
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
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-orange-100 mb-4">
          <Image className="h-8 w-8 text-orange-600" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h1 className="text-2xl font-bold text-surface-900">Image Generator</h1>
          <Badge variant="warning">Binnenkort</Badge>
        </div>
        <p className="text-surface-600 max-w-md mx-auto">
          Creëer unieke afbeeldingen voor je Display en Performance Max campagnes met AI.
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card className="mb-8 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-orange-600" />
            <span className="font-semibold text-orange-900">In ontwikkeling</span>
          </div>
          <p className="text-surface-600 mb-6">
            We werken hard aan deze feature. Binnenkort kun je hier AI-gegenereerde
            afbeeldingen maken voor je Google Ads campagnes.
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
