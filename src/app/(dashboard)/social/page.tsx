'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Type,
  Image,
  ChevronRight,
  Sparkles,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tools = [
  {
    name: 'Post Generator',
    description: 'Genereer engaging social media posts voor LinkedIn, Instagram en Facebook.',
    href: '/social/posts',
    icon: Type,
    color: 'bg-pink-500',
    badge: 'Populair',
    badgeVariant: 'primary' as const,
  },
  {
    name: 'Afbeeldingen',
    description: 'Creëer visueel aantrekkelijke afbeeldingen voor je social media posts met GPT Image.',
    href: '/social/images',
    icon: Image,
    color: 'bg-purple-500',
    badge: 'Nieuw',
    badgeVariant: 'success' as const,
  },
]

export default function SocialPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Share2 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Social Media</h1>
        </div>
        <p className="text-surface-600">
          AI-powered tools om je social media content naar een hoger niveau te tillen.
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

      {/* Tips Section */}
      <Card className="mt-8 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900 mb-1">Pro tip</h3>
              <p className="text-sm text-surface-600">
                Pas je tone of voice aan per platform. LinkedIn vraagt om een professionelere toon,
                terwijl Instagram meer casual en visueel mag zijn.
                Gebruik hashtags strategisch en test verschillende formats.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
