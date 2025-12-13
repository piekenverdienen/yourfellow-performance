'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  ChevronRight,
  Sparkles,
  MousePointerClick,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tools = [
  {
    name: 'URL Analyzer',
    description: 'Analyseer landingspaginas op basis van Cialdinis 6 overtuigingsprincipes.',
    href: '/cro/analyzer',
    icon: BarChart3,
    color: 'bg-red-500',
    badge: 'Nieuw',
    badgeVariant: 'success' as const,
  },
]

export default function CROPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <MousePointerClick className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">CRO Tools</h1>
        </div>
        <p className="text-surface-600">
          Optimaliseer je conversies met AI-powered analyse en suggesties.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid gap-4">
        {tools.map((tool) => {
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

      {/* Cialdini Info */}
      <Card className="mt-8 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900 mb-2">Cialdinis 6 overtuigingsprincipes</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-surface-600">
                <div>1. Wederkerigheid</div>
                <div>2. Schaarste</div>
                <div>3. Autoriteit</div>
                <div>4. Consistentie</div>
                <div>5. Sympathie</div>
                <div>6. Sociale bewijskracht</div>
              </div>
              <p className="text-sm text-surface-500 mt-3">
                Deze principes vormen de basis van effectieve overtuiging en worden gebruikt door de beste marketeers wereldwijd.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
