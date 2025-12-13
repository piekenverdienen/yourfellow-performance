'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Share2,
  Target,
  Hash,
  MessageSquare,
} from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'

const platformOptions = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X (Twitter)' },
]

const toneOptions = [
  { value: 'professional', label: 'Professioneel' },
  { value: 'casual', label: 'Casual' },
  { value: 'inspiring', label: 'Inspirerend' },
  { value: 'humorous', label: 'Humoristisch' },
  { value: 'educational', label: 'Educatief' },
]

const postTypeOptions = [
  { value: 'announcement', label: 'Aankondiging' },
  { value: 'tips', label: 'Tips & Tricks' },
  { value: 'behind_scenes', label: 'Behind the Scenes' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'question', label: 'Vraag aan volgers' },
]

interface GeneratedPost {
  primary_text: string
  headline: string
  hashtags: string[]
  suggested_cta: string
}

export default function SocialPostsPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = useState({
    topic: '',
    context: '',
    targetAudience: '',
    platform: 'linkedin',
    tone: 'professional',
    postType: 'announcement',
  })
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const prompt = `Genereer een social media post voor het volgende:

Platform: ${formData.platform}
Onderwerp: ${formData.topic}
Context/Details: ${formData.context || 'Geen extra context'}
Doelgroep: ${formData.targetAudience || 'Algemeen publiek'}
Tone of voice: ${formData.tone}
Type post: ${formData.postType}

Schrijf een engaging post in het Nederlands die past bij het platform en de doelgroep.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'social-copy',
          prompt,
          options: {
            platform: formData.platform,
            tone: formData.tone,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Er ging iets mis bij het genereren')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Generatie mislukt')
      }

      // Strip markdown code blocks if present
      let resultText = data.result
      if (resultText.startsWith('```')) {
        resultText = resultText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      const parsedResult = JSON.parse(resultText)

      setGeneratedPost({
        primary_text: parsedResult.primary_text || '',
        headline: parsedResult.headline || '',
        hashtags: parsedResult.hashtags || [],
        suggested_cta: parsedResult.suggested_cta || '',
      })
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleCopyAll = async () => {
    if (!generatedPost) return

    const allText = [
      generatedPost.primary_text,
      '',
      generatedPost.hashtags.join(' '),
    ].join('\n')

    await copyToClipboard(allText)
    setCopiedField('all')
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <Share2 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Social Media Posts</h1>
        </div>
        <p className="text-surface-600">
          Genereer engaging social media posts voor al je platformen met AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Invoer</CardTitle>
            <CardDescription>
              Vul de details in voor je social media post
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Onderwerp</label>
              <Input
                placeholder="bijv. Lancering nieuwe dienst"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                leftIcon={<Target className="h-4 w-4" />}
              />
            </div>

            <div>
              <label className="label">Context / Details</label>
              <Textarea
                placeholder="Beschrijf waar de post over moet gaan..."
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            <div>
              <label className="label">Doelgroep</label>
              <Input
                placeholder="bijv. Marketing managers in B2B"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Platform</label>
                <Select
                  options={platformOptions}
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Type post</label>
                <Select
                  options={postTypeOptions}
                  value={formData.postType}
                  onChange={(e) => setFormData({ ...formData, postType: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Tone of voice</label>
              <Select
                options={toneOptions}
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              />
            </div>

            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!formData.topic}
            >
              {isGenerating ? 'Genereren...' : 'Genereer post'}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Resultaat</CardTitle>
              <CardDescription>
                Je gegenereerde social media post
              </CardDescription>
            </div>
            {generatedPost && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  leftIcon={copiedField === 'all' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {copiedField === 'all' ? 'Gekopieerd!' : 'Kopieer alles'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Opnieuw
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-medium">Fout bij genereren</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-surface-600">AI is aan het schrijven...</p>
                <p className="text-sm text-surface-400 mt-1">Dit duurt meestal 5-10 seconden</p>
              </div>
            ) : generatedPost ? (
              <div className="space-y-6">
                {/* Main Post */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-surface-900">Post tekst</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(generatedPost.primary_text, 'text')}
                    >
                      {copiedField === 'text' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="p-4 bg-surface-50 rounded-lg">
                    <p className="text-surface-900 whitespace-pre-wrap">{generatedPost.primary_text}</p>
                  </div>
                </div>

                {/* Headline */}
                {generatedPost.headline && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-surface-900">Headline</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedPost.headline, 'headline')}
                      >
                        {copiedField === 'headline' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="p-4 bg-surface-50 rounded-lg">
                      <p className="text-surface-900 font-medium">{generatedPost.headline}</p>
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {generatedPost.hashtags.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-surface-500" />
                        <h4 className="font-medium text-surface-900">Hashtags</h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedPost.hashtags.join(' '), 'hashtags')}
                      >
                        {copiedField === 'hashtags' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {generatedPost.hashtags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                {generatedPost.suggested_cta && (
                  <div>
                    <h4 className="font-medium text-surface-900 mb-3">Voorgestelde CTA</h4>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-surface-900">{generatedPost.suggested_cta}</p>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="pt-4 border-t border-surface-200">
                  <p className="text-sm text-surface-500 mb-3">Was dit resultaat nuttig?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" leftIcon={<ThumbsUp className="h-4 w-4" />}>
                      Ja, goed!
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<ThumbsDown className="h-4 w-4" />}>
                      Kan beter
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-surface-400" />
                </div>
                <p className="text-surface-600">Vul het formulier in en klik op genereer</p>
                <p className="text-sm text-surface-400 mt-1">
                  Je resultaten verschijnen hier
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
