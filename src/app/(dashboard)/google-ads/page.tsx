'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useClientStore } from '@/stores/client-store'
import {
  Type,
  Database,
  Image,
  ChevronRight,
  Sparkles,
  Megaphone,
  BarChart3,
  Lightbulb,
  Zap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const dashboardTools = [
  {
    name: 'Performance Dashboard',
    description: 'Bekijk KPIs, trends en vergelijk periodes. Alles in één overzicht.',
    href: '/google-ads/dashboard',
    icon: BarChart3,
    color: 'bg-blue-500',
    badge: null,
  },
  {
    name: 'Performance Max Analyse',
    description: 'Analyseer je PMax campagnes, asset groups en signalen.',
    href: '/google-ads/pmax',
    icon: Zap,
    color: 'bg-purple-500',
    badge: null,
  },
  {
    name: 'AI Insights',
    description: 'Automatische optimalisatie tips gebaseerd op je data.',
    href: '/google-ads/insights',
    icon: Lightbulb,
    color: 'bg-amber-500',
    badge: 'Nieuw',
    badgeVariant: 'primary' as const,
  },
  {
    name: 'Alerts',
    description: 'Bekijk kritieke issues en monitoring alerts.',
    href: '/alerts?channel=google_ads',
    icon: AlertTriangle,
    color: 'bg-red-500',
    badge: null,
  },
]

const contentTools = [
  {
    name: 'Ad Teksten Generator',
    description: 'Genereer overtuigende headlines en descriptions voor je campagnes.',
    href: '/google-ads/copy',
    icon: Type,
    color: 'bg-blue-500',
    badge: 'Populair',
    badgeVariant: 'primary' as const,
  },
  {
    name: 'Feed Management',
    description: 'Optimaliseer je product feed titels en beschrijvingen.',
    href: '/google-ads/feed',
    icon: Database,
    color: 'bg-purple-500',
    badge: 'Binnenkort',
    badgeVariant: 'warning' as const,
  },
  {
    name: 'Image Generator',
    description: 'Creëer unieke afbeeldingen voor Display en Performance Max.',
    href: '/google-ads/images',
    icon: Image,
    color: 'bg-orange-500',
    badge: 'Binnenkort',
    badgeVariant: 'warning' as const,
  },
]

export default function GoogleAdsPage() {
  const { selectedClient } = useClientStore()
  const googleAdsConfigured = selectedClient?.settings?.googleAds?.customerId

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Megaphone className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Google Ads</h1>
        </div>
        <p className="text-surface-600">
          Monitor, analyseer en optimaliseer je Google Ads campagnes met AI-powered tools.
        </p>
      </div>

      {/* Dashboard & Monitoring Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-surface-500" />
          Dashboard & Monitoring
        </h2>

        {!googleAdsConfigured && selectedClient && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Google Ads niet geconfigureerd</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Configureer de Google Ads koppeling voor {selectedClient.name} om monitoring en analyses te gebruiken.
                  </p>
                  <Link
                    href={`/clients/${selectedClient.id}?tab=settings`}
                    className="text-sm font-medium text-amber-900 underline mt-2 inline-block"
                  >
                    Configureer nu →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {dashboardTools.map((tool) => {
            const Icon = tool.icon
            const isDisabled = !googleAdsConfigured && tool.href !== '/alerts?channel=google_ads'

            return (
              <Link
                key={tool.name}
                href={isDisabled ? '#' : tool.href}
                className={cn(isDisabled && 'pointer-events-none opacity-60')}
              >
                <Card
                  variant="interactive"
                  className="group"
                  padding="none"
                >
                  <CardContent className="p-6 flex items-center gap-5">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0',
                      tool.color
                    )}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-surface-900 group-hover:text-primary transition-colors">
                          {tool.name}
                        </h3>
                        {tool.badge && (
                          <Badge variant={tool.badgeVariant!}>{tool.badge}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-surface-600">{tool.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-surface-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content Generation Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-surface-500" />
          Content Generatie
        </h2>
        <div className="grid gap-4">
          {contentTools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.name} href={tool.href}>
                <Card
                  variant="interactive"
                  className="group"
                  padding="none"
                >
                  <CardContent className="p-6 flex items-center gap-5">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0',
                      tool.color
                    )}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-surface-900 group-hover:text-primary transition-colors">
                          {tool.name}
                        </h3>
                        {tool.badge && (
                          <Badge variant={tool.badgeVariant!}>{tool.badge}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-surface-600">{tool.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-surface-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Tips Section */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900 mb-1">Pro tip</h3>
              <p className="text-sm text-surface-600">
                Begin met het Performance Dashboard voor een snel overzicht van je account.
                Gebruik daarna de AI Insights om automatisch optimalisatie kansen te ontdekken.
                De insights zijn volledig deterministisch en elke aanbeveling is uitlegbaar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
