'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Globe,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CialdiniPrinciple {
  name: string
  score: number
  found_elements: string[]
  suggestions: string[]
}

interface AnalysisResult {
  overall_score: number
  principles: CialdiniPrinciple[]
  top_improvements: string[]
}

const principleColors: Record<string, string> = {
  'Wederkerigheid': 'bg-blue-500',
  'Schaarste': 'bg-orange-500',
  'Autoriteit': 'bg-purple-500',
  'Consistentie': 'bg-green-500',
  'Sympathie': 'bg-pink-500',
  'Sociale bewijskracht': 'bg-yellow-500',
}

export default function CROAnalyzerPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [formData, setFormData] = useState({
    url: '',
    pageContent: '',
    pageType: '',
  })
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const prompt = `Analyseer de volgende landingspagina op basis van Cialdini's 6 overtuigingsprincipes:

URL: ${formData.url || 'Niet opgegeven'}
Type pagina: ${formData.pageType || 'Landingspagina'}

Pagina inhoud:
${formData.pageContent}

Geef een score van 0-10 voor elk principe en concrete verbeterpunten.`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'cro-analyzer',
          prompt,
          options: {},
        }),
      })

      if (!response.ok) {
        throw new Error('Er ging iets mis bij het analyseren')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Analyse mislukt')
      }

      const parsedResult = JSON.parse(data.result)
      setAnalysisResult(parsedResult)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100'
    if (score >= 6) return 'bg-yellow-100'
    if (score >= 4) return 'bg-orange-100'
    return 'bg-red-100'
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-brand">
            <BarChart3 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">CRO Analyzer</h1>
        </div>
        <p className="text-surface-600">
          Analyseer je landingspaginas op basis van Cialdinis 6 overtuigingsprincipes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Pagina Analyse</CardTitle>
            <CardDescription>
              Plak de inhoud van je landingspagina voor analyse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Pagina URL (optioneel)</label>
              <Input
                placeholder="bijv. https://example.com/landing"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                leftIcon={<Globe className="h-4 w-4" />}
              />
            </div>

            <div>
              <label className="label">Type pagina (optioneel)</label>
              <Input
                placeholder="bijv. Product landingspagina, Diensten pagina"
                value={formData.pageType}
                onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Pagina inhoud</label>
              <Textarea
                placeholder="Kopieer en plak hier de tekst van je landingspagina...

Inclusief headlines, body text, CTA's, testimonials, etc."
                value={formData.pageContent}
                onChange={(e) => setFormData({ ...formData, pageContent: e.target.value })}
                className="min-h-[250px]"
              />
            </div>

            <Button
              onClick={handleAnalyze}
              isLoading={isAnalyzing}
              className="w-full"
              size="lg"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={!formData.pageContent}
            >
              {isAnalyzing ? 'Analyseren...' : 'Analyseer pagina'}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Analyse Resultaat</CardTitle>
              <CardDescription>
                Score per overtuigingsprincipe
              </CardDescription>
            </div>
            {analysisResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Opnieuw
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-medium">Fout bij analyseren</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-surface-600">AI is aan het analyseren...</p>
                <p className="text-sm text-surface-400 mt-1">Dit kan even duren</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className={cn(
                  'p-6 rounded-xl text-center',
                  getScoreBgColor(analysisResult.overall_score)
                )}>
                  <p className="text-sm text-surface-600 mb-1">Overall Score</p>
                  <p className={cn('text-5xl font-bold', getScoreColor(analysisResult.overall_score))}>
                    {analysisResult.overall_score}/10
                  </p>
                </div>

                {/* Principles */}
                <div className="space-y-4">
                  <h4 className="font-medium text-surface-900">Score per principe</h4>
                  {analysisResult.principles.map((principle, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            principleColors[principle.name] || 'bg-gray-500'
                          )} />
                          <span className="font-medium text-surface-900">{principle.name}</span>
                        </div>
                        <span className={cn('font-bold', getScoreColor(principle.score))}>
                          {principle.score}/10
                        </span>
                      </div>
                      <Progress value={principle.score * 10} className="h-2" />

                      {/* Found elements */}
                      {principle.found_elements.length > 0 && (
                        <div className="pl-5 space-y-1">
                          {principle.found_elements.map((element, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-surface-600">{element}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggestions */}
                      {principle.suggestions.length > 0 && (
                        <div className="pl-5 space-y-1">
                          {principle.suggestions.map((suggestion, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                              <span className="text-surface-600">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Top Improvements */}
                {analysisResult.top_improvements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-surface-900 mb-3">Top 3 verbeterpunten</h4>
                    <div className="space-y-2">
                      {analysisResult.top_improvements.map((improvement, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                          <Badge variant="primary" className="flex-shrink-0">{index + 1}</Badge>
                          <span className="text-surface-700">{improvement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="pt-4 border-t border-surface-200">
                  <p className="text-sm text-surface-500 mb-3">Was deze analyse nuttig?</p>
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
                <p className="text-surface-600">Plak je pagina-inhoud en klik op analyseer</p>
                <p className="text-sm text-surface-400 mt-1">
                  Je analyse resultaten verschijnen hier
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
