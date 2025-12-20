'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Globe,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react'
import type { ClientContext } from '@/types'

interface WebsiteAnalyzerProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onContextGenerated: (context: ClientContext) => void
}

interface GeneratedContextPreview {
  context: ClientContext
  pagesAnalyzed: number
  sourceUrl: string
}

export function WebsiteAnalyzer({
  clientId,
  open,
  onOpenChange,
  onContextGenerated,
}: WebsiteAnalyzerProps) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [maxPages, setMaxPages] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GeneratedContextPreview | null>(null)

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) {
      setError('Vul een website URL in')
      return
    }

    // Basic URL validation - add protocol if missing
    let url = websiteUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/generate-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: url, maxPages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Er ging iets mis')
      }

      setPreview({
        context: data.context,
        pagesAnalyzed: data.pagesAnalyzed,
        sourceUrl: data.sourceUrl,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (preview) {
      onContextGenerated(preview.context)
      onOpenChange(false)
      // Reset state
      setWebsiteUrl('')
      setPreview(null)
      setError(null)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after animation
    setTimeout(() => {
      setWebsiteUrl('')
      setPreview(null)
      setError(null)
      setLoading(false)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogClose onClose={handleClose} />

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Context Genereren
          </DialogTitle>
          <DialogDescription>
            Analyseer een website om automatisch de AI context in te vullen.
            We scrapen meerdere pagina&apos;s en gebruiken AI om de belangrijkste informatie te extraheren.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* URL Input */}
          {!preview && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Website URL
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="bijv. example.nl of https://example.nl"
                      className="pl-10"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !loading) {
                          handleAnalyze()
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Aantal pagina&apos;s om te analyseren
                </label>
                <div className="flex gap-2">
                  {[3, 5, 8, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setMaxPages(num)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        maxPages === num
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-surface-200 text-surface-600 hover:border-surface-300'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {num} pagina&apos;s
                    </button>
                  ))}
                </div>
                <p className="text-xs text-surface-500 mt-1.5">
                  Meer pagina&apos;s = meer context, maar duurt langer
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-surface-700 font-medium">Website analyseren...</p>
              <p className="text-sm text-surface-500 mt-1">
                We crawlen tot {maxPages} pagina&apos;s en genereren de AI context
              </p>
            </div>
          )}

          {/* Preview */}
          {preview && !loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <Check className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>{preview.pagesAnalyzed} pagina&apos;s</strong> geanalyseerd van{' '}
                  <span className="font-mono text-xs">{preview.sourceUrl}</span>
                </span>
              </div>

              <div className="border border-surface-200 rounded-lg divide-y divide-surface-200 max-h-[400px] overflow-y-auto">
                {/* Propositie */}
                <PreviewSection
                  label="Propositie"
                  value={preview.context.proposition}
                />

                {/* Doelgroep */}
                <PreviewSection
                  label="Doelgroep"
                  value={preview.context.targetAudience}
                />

                {/* USPs */}
                <PreviewSection
                  label="USP's"
                  value={preview.context.usps}
                  isArray
                />

                {/* Tone of Voice */}
                <PreviewSection
                  label="Tone of Voice"
                  value={preview.context.toneOfVoice}
                />

                {/* Brand Voice */}
                <PreviewSection
                  label="Brand Voice"
                  value={preview.context.brandVoice}
                />

                {/* Bestsellers */}
                {preview.context.bestsellers && preview.context.bestsellers.length > 0 && (
                  <PreviewSection
                    label="Bestsellers"
                    value={preview.context.bestsellers}
                    isArray
                  />
                )}

                {/* Seasonality */}
                {preview.context.seasonality && preview.context.seasonality.length > 0 && (
                  <PreviewSection
                    label="Seizoensgebonden"
                    value={preview.context.seasonality}
                    isArray
                  />
                )}
              </div>

              <p className="text-xs text-surface-500">
                Je kunt de gegenereerde context na het toepassen nog aanpassen in het formulier.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!preview ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Annuleren
              </Button>
              <Button onClick={handleAnalyze} disabled={loading || !websiteUrl.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyseren...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyseer Website
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null)
                  setError(null)
                }}
              >
                Opnieuw proberen
              </Button>
              <Button onClick={handleApply}>
                <Check className="h-4 w-4 mr-2" />
                Context Toepassen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewSection({
  label,
  value,
  isArray = false,
}: {
  label: string
  value: string | string[]
  isArray?: boolean
}) {
  return (
    <div className="p-3">
      <div className="text-xs font-medium text-surface-500 mb-1">{label}</div>
      {isArray ? (
        <div className="flex flex-wrap gap-1.5">
          {(value as string[]).map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-surface-700">{value || '-'}</div>
      )}
    </div>
  )
}
