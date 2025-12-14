'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  FileText,
  Megaphone,
  Share2,
  Mail,
  Search,
  BarChart3,
  Folder,
  Loader2,
  Play,
  Filter,
  ChevronDown,
  Settings,
} from 'lucide-react'
import { Playbook, PlaybookCategory } from '@/types'
import { useSelectedClientId } from '@/stores/client-store'

const CATEGORY_ICONS: Record<PlaybookCategory, React.ElementType> = {
  content: FileText,
  seo: Search,
  ads: Megaphone,
  social: Share2,
  email: Mail,
  analysis: BarChart3,
  other: Folder,
}

const CATEGORY_LABELS: Record<PlaybookCategory, string> = {
  content: 'Content',
  seo: 'SEO',
  ads: 'Advertising',
  social: 'Social Media',
  email: 'Email',
  analysis: 'Analysis',
  other: 'Overig',
}

const CATEGORY_COLORS: Record<PlaybookCategory, string> = {
  content: 'bg-blue-100 text-blue-700',
  seo: 'bg-green-100 text-green-700',
  ads: 'bg-orange-100 text-orange-700',
  social: 'bg-pink-100 text-pink-700',
  email: 'bg-purple-100 text-purple-700',
  analysis: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PlaybookCategory | 'all'>('all')
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const selectedClientId = useSelectedClientId()

  useEffect(() => {
    fetchPlaybooks()
  }, [selectedCategory])

  const fetchPlaybooks = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }

      const res = await fetch(`/api/playbooks?${params.toString()}`)
      const data = await res.json()

      setPlaybooks(data.playbooks || [])
      setIsOrgAdmin(data.isOrgAdmin || false)
    } catch (error) {
      console.error('Error fetching playbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = Object.keys(CATEGORY_LABELS) as PlaybookCategory[]

  // Group playbooks by category
  const groupedPlaybooks = playbooks.reduce((acc, playbook) => {
    const category = playbook.category
    if (!acc[category]) acc[category] = []
    acc[category].push(playbook)
    return acc
  }, {} as Record<PlaybookCategory, Playbook[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Playbooks</h1>
          <p className="text-surface-600 mt-1">
            Kant-en-klare AI templates voor marketing content
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {selectedCategory === 'all' ? 'Alle categorieën' : CATEGORY_LABELS[selectedCategory]}
              <ChevronDown className="h-4 w-4" />
            </Button>
            {showCategoryFilter && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-surface-200 py-2 z-10">
                <button
                  onClick={() => {
                    setSelectedCategory('all')
                    setShowCategoryFilter(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-surface-100 ${
                    selectedCategory === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-surface-700'
                  }`}
                >
                  Alle categorieën
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat)
                      setShowCategoryFilter(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-surface-100 ${
                      selectedCategory === cat ? 'bg-primary/10 text-primary font-medium' : 'text-surface-700'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isOrgAdmin && (
            <Link href="/playbooks/admin">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Beheer
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* No client selected warning */}
      {!selectedClientId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
          <p className="text-sm">
            <strong>Let op:</strong> Selecteer een client om playbooks uit te voeren met de juiste context.
          </p>
        </div>
      )}

      {/* Playbooks Grid - Grouped by category */}
      {selectedCategory === 'all' ? (
        Object.entries(groupedPlaybooks).map(([category, categoryPlaybooks]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-4">
              {(() => {
                const Icon = CATEGORY_ICONS[category as PlaybookCategory]
                return <Icon className="h-5 w-5 text-primary" />
              })()}
              <h2 className="text-lg font-semibold text-surface-900">
                {CATEGORY_LABELS[category as PlaybookCategory]}
              </h2>
              <span className="text-sm text-surface-500">({categoryPlaybooks.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPlaybooks.map((playbook) => (
                <PlaybookCard key={playbook.id} playbook={playbook} hasClient={!!selectedClientId} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playbooks.map((playbook) => (
            <PlaybookCard key={playbook.id} playbook={playbook} hasClient={!!selectedClientId} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {playbooks.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Geen playbooks gevonden
            </h3>
            <p className="text-surface-600">
              {selectedCategory !== 'all'
                ? `Er zijn nog geen playbooks in de categorie "${CATEGORY_LABELS[selectedCategory]}".`
                : 'Er zijn nog geen playbooks beschikbaar.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PlaybookCard({ playbook, hasClient }: { playbook: Playbook; hasClient: boolean }) {
  const Icon = CATEGORY_ICONS[playbook.category]

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${CATEGORY_COLORS[playbook.category]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">{playbook.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-surface-600 line-clamp-2">
          {playbook.description || 'Geen beschrijving'}
        </p>

        <div className="flex items-center gap-4 text-xs text-surface-500">
          <span className="px-2 py-1 bg-surface-100 rounded-full">
            {CATEGORY_LABELS[playbook.category]}
          </span>
          <span>~{playbook.estimated_tokens} tokens</span>
          <span>+{playbook.xp_reward} XP</span>
        </div>

        <Link href={`/playbooks/${playbook.slug}`}>
          <Button
            variant={hasClient ? 'default' : 'outline'}
            size="sm"
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {hasClient ? 'Uitvoeren' : 'Bekijken'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
