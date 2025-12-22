'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Globe,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Target,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  History,
  RotateCcw,
  Building2,
  Megaphone,
  DollarSign,
  Swords,
  MessageSquare,
  ShoppingBag,
  Lightbulb,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import type { GetContextResponse, IntakeJob } from '@/lib/context/types'
import type { AIContext, ContextSummary } from '@/lib/context'

interface AIContextIntakeProps {
  clientId: string
  clientName: string
  canEdit: boolean
}

type IntakeStep = 'idle' | 'configuring' | 'running' | 'completed' | 'error'

// Collapsible section component
function ContextSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-surface-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Icon className="h-5 w-5 text-primary" />
            {title}
            {badge && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {badge}
              </Badge>
            )}
          </CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-surface-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-surface-400" />
          )}
        </div>
      </CardHeader>
      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

// Field display component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="py-2">
      <label className="text-xs font-medium text-surface-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="mt-1 text-surface-900">{children}</div>
    </div>
  )
}

export function AIContextIntake({ clientId, clientName, canEdit }: AIContextIntakeProps) {
  // State
  const [step, setStep] = useState<IntakeStep>('idle')
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<AIContext | null>(null)
  const [summary, setSummary] = useState<ContextSummary | null>(null)
  const [contextVersion, setContextVersion] = useState(0)
  const [contextStatus, setContextStatus] = useState<string>('pending')

  // Intake job state
  const [currentJob, setCurrentJob] = useState<IntakeJob | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState('')
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<{ version: number; generatedAt: string; isActive: boolean }[]>([])

  // Fetch current context
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/context`)
      const data: GetContextResponse = await res.json()

      if (data.success) {
        setContext(data.context)
        setSummary(data.summary)
        setContextVersion(data.version)
        setContextStatus(data.status)

        if (data.context) {
          setStep('completed')
        }
      }
    } catch (err) {
      console.error('Error fetching context:', err)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  // Check for running jobs
  const checkRunningJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/intake-jobs`)
      const data = await res.json()

      if (data.success && data.jobs) {
        const runningJob = data.jobs.find((j: IntakeJob) =>
          ['pending', 'scraping', 'analyzing', 'generating'].includes(j.status)
        )
        if (runningJob) {
          setCurrentJob(runningJob)
          setStep('running')
        }
      }
    } catch (err) {
      console.error('Error checking jobs:', err)
    }
  }, [clientId])

  // Poll job status
  const pollJobStatus = useCallback(async () => {
    if (!currentJob) return

    try {
      const res = await fetch(`/api/intake-jobs/${currentJob.id}`)
      const data = await res.json()

      if (data.success && data.job) {
        setCurrentJob(data.job)

        if (data.job.status === 'completed') {
          setStep('completed')
          fetchContext()
        } else if (data.job.status === 'failed') {
          setStep('error')
          setError(data.job.error_message || 'Intake gefaald')
        }
      }
    } catch (err) {
      console.error('Error polling job:', err)
    }
  }, [currentJob, fetchContext])

  // Initial load
  useEffect(() => {
    fetchContext()
    checkRunningJobs()
  }, [fetchContext, checkRunningJobs])

  // Poll while running
  useEffect(() => {
    if (step !== 'running' || !currentJob) return

    const interval = setInterval(pollJobStatus, 2000)
    return () => clearInterval(interval)
  }, [step, currentJob, pollJobStatus])

  // Start intake
  const startIntake = async () => {
    if (!websiteUrl.trim()) {
      setError('Website URL is verplicht')
      return
    }

    setError(null)
    setStep('running')

    try {
      const jobRes = await fetch(`/api/clients/${clientId}/intake-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'full_intake',
          config: {
            website_url: websiteUrl,
            competitor_urls: competitorUrls
              .split('\n')
              .map((u) => u.trim())
              .filter(Boolean),
          },
        }),
      })
      const jobData = await jobRes.json()

      if (!jobData.success) {
        throw new Error(jobData.error || 'Kon intake niet starten')
      }

      const processRes = await fetch(`/api/intake-jobs/${jobData.jobId}/process`, {
        method: 'POST',
      })
      const processData = await processRes.json()

      if (!processData.success) {
        throw new Error(processData.error || processData.details || 'Intake verwerking gefaald')
      }

      const statusRes = await fetch(`/api/intake-jobs/${jobData.jobId}`)
      const statusData = await statusRes.json()
      if (statusData.success) {
        setCurrentJob(statusData.job)
        if (statusData.job.status === 'completed') {
          setStep('completed')
          fetchContext()
        } else if (statusData.job.status === 'failed') {
          throw new Error(statusData.job.error_message || 'Intake gefaald')
        }
      }
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  const fetchVersions = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/context/versions`)
      const data = await res.json()
      if (data.success) {
        setVersions(data.versions)
      }
    } catch (err) {
      console.error('Error fetching versions:', err)
    }
  }

  const activateVersion = async (version: number) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/context/activate/${version}`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchContext()
        fetchVersions()
      }
    } catch (err) {
      console.error('Error activating version:', err)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Idle state
  if (step === 'idle' || step === 'configuring') {
    return (
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-primary/10 rounded-2xl">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-surface-900">
                AI Context Genereren
              </h3>
              <p className="text-surface-600 mt-1">
                Analyseer de website van {clientName} om automatisch context te genereren
              </p>
            </div>

            {step === 'idle' && canEdit && (
              <Button size="lg" onClick={() => setStep('configuring')}>
                <Globe className="h-5 w-5 mr-2" />
                Start Intake
              </Button>
            )}
          </div>

          {step === 'configuring' && (
            <div className="mt-8 max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Website URL *
                </label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.voorbeeld.nl"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Concurrenten (optioneel, één per regel)
                </label>
                <textarea
                  value={competitorUrls}
                  onChange={(e) => setCompetitorUrls(e.target.value)}
                  placeholder="https://concurrent1.nl&#10;https://concurrent2.nl"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('idle')} className="flex-1">
                  Annuleren
                </Button>
                <Button onClick={startIntake} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Starten
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Running state
  if (step === 'running' && currentJob) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-6">
            <div className="inline-flex p-4 bg-primary/10 rounded-2xl animate-pulse">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>

            <div>
              <h3 className="text-xl font-semibold text-surface-900">
                Context wordt gegenereerd...
              </h3>
              <p className="text-surface-600 mt-1">
                {currentJob.current_step === 'scraping' && 'Website wordt geanalyseerd...'}
                {currentJob.current_step === 'analyzing' && 'Data wordt verwerkt...'}
                {currentJob.current_step === 'generating' && 'AI genereert context...'}
                {!currentJob.current_step && 'Even geduld...'}
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${currentJob.progress}%` }}
                />
              </div>
              <p className="text-sm text-surface-500 mt-2">{currentJob.progress}%</p>
            </div>

            <div className="flex justify-center gap-8 text-sm">
              {['scraping', 'analyzing', 'generating'].map((s) => {
                const stepStatus = currentJob.steps_completed?.find((sc) => sc.name === s)
                const isCurrent = currentJob.current_step === s
                const isCompleted = stepStatus?.status === 'completed'

                return (
                  <div key={s} className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : isCurrent ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Clock className="h-5 w-5 text-surface-300" />
                    )}
                    <span
                      className={
                        isCompleted
                          ? 'text-green-600'
                          : isCurrent
                          ? 'text-primary font-medium'
                          : 'text-surface-400'
                      }
                    >
                      {s === 'scraping' && 'Scrapen'}
                      {s === 'analyzing' && 'Analyseren'}
                      {s === 'generating' && 'Genereren'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (step === 'error') {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-red-100 rounded-2xl">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-surface-900">Er ging iets mis</h3>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
            {canEdit && (
              <Button onClick={() => setStep('configuring')}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Opnieuw proberen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Completed state - Full context display
  const obs = context?.observations
  const targetAudience = obs?.targetAudience
  const brandVoice = obs?.brandVoice

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-surface-900">AI Context Actief</h3>
                <p className="text-sm text-surface-500">
                  Versie {contextVersion} • {context?.lastUpdated && new Date(context.lastUpdated).toLocaleDateString('nl-NL')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetchVersions()
                      setShowVersions(!showVersions)
                    }}
                  >
                    <History className="h-4 w-4 mr-1" />
                    Versies
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setStep('configuring')}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Opnieuw
                  </Button>
                </>
              )}
            </div>
          </div>

          {showVersions && versions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100">
              <h4 className="text-sm font-medium text-surface-700 mb-2">Versie Geschiedenis</h4>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.version} className="flex items-center justify-between p-2 bg-surface-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {v.isActive && <Badge variant="default" className="text-xs">Actief</Badge>}
                      <span className="text-sm text-surface-500">
                        {new Date(v.generatedAt).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    {!v.isActive && canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => activateVersion(v.version)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Activeren
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary - Always visible */}
      {summary && (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Samenvatting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold text-surface-900">{summary.oneLiner}</p>
            <p className="text-surface-600">{summary.shortDescription}</p>
            {summary.keyFacts && summary.keyFacts.length > 0 && (
              <ul className="space-y-1 pt-2">
                {summary.keyFacts.map((fact: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-surface-700 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {fact}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confidence Score */}
      {context?.confidence && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-surface-700">Context Kwaliteit</span>
                  <span className="text-sm font-bold text-surface-900">
                    {Math.round(context.confidence.overall * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      context.confidence.overall >= 0.7
                        ? 'bg-green-500'
                        : context.confidence.overall >= 0.5
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${context.confidence.overall * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {context && (
        <>
          {/* Company Overview */}
          <ContextSection title="Bedrijfsprofiel" icon={Building2} defaultOpen={true}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bedrijfsnaam">{obs?.companyName}</Field>
              <Field label="Website">
                {obs?.website && (
                  <a href={obs.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {obs.website} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Field>
              <Field label="Industrie">{obs?.industry}</Field>
              <Field label="Sub-industrie">{obs?.subIndustry}</Field>
              <div className="sm:col-span-2">
                <Field label="Propositie">{obs?.proposition}</Field>
              </div>
              {obs?.tagline && <Field label="Tagline">"{obs.tagline}"</Field>}
            </div>
          </ContextSection>

          {/* Target Audience */}
          <ContextSection
            title="Doelgroep"
            icon={Users}
            badge={targetAudience?.primary ? '✓' : undefined}
          >
            <div className="space-y-4">
              <Field label="Primaire doelgroep">
                {typeof targetAudience === 'string' ? targetAudience : targetAudience?.primary}
              </Field>
              {typeof targetAudience === 'object' && targetAudience?.secondary && (
                <Field label="Secundaire doelgroep">{targetAudience.secondary}</Field>
              )}
              {typeof targetAudience === 'object' && targetAudience?.demographics && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {targetAudience.demographics.ageRange && (
                    <Field label="Leeftijd">{targetAudience.demographics.ageRange}</Field>
                  )}
                  {targetAudience.demographics.location && targetAudience.demographics.location.length > 0 && (
                    <Field label="Locatie">
                      <div className="flex flex-wrap gap-1">
                        {targetAudience.demographics.location.map((loc: string, i: number) => (
                          <Badge key={i} variant="outline">{loc}</Badge>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>
              )}
              {typeof targetAudience === 'object' && targetAudience?.psychographics && (
                <>
                  {targetAudience.psychographics.interests && targetAudience.psychographics.interests.length > 0 && (
                    <Field label="Interesses">
                      <div className="flex flex-wrap gap-1">
                        {targetAudience.psychographics.interests.map((i: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{i}</Badge>
                        ))}
                      </div>
                    </Field>
                  )}
                  {targetAudience.psychographics.painPoints && targetAudience.psychographics.painPoints.length > 0 && (
                    <Field label="Pijnpunten">
                      <ul className="space-y-1">
                        {targetAudience.psychographics.painPoints.map((p: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </Field>
                  )}
                </>
              )}
            </div>
          </ContextSection>

          {/* USPs */}
          {obs?.usps && obs.usps.length > 0 && (
            <ContextSection title="Unique Selling Points" icon={Lightbulb} badge={`${obs.usps.length}`}>
              <div className="space-y-2">
                {obs.usps.map((usp: { text: string; confidence: string }, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-lg">
                    <CheckCircle2 className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      usp.confidence === 'high' ? 'text-green-500' :
                      usp.confidence === 'medium' ? 'text-yellow-500' : 'text-surface-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-surface-900">{usp.text}</p>
                      <span className="text-xs text-surface-500">Confidence: {usp.confidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ContextSection>
          )}

          {/* Products */}
          {obs?.products && obs.products.length > 0 && (
            <ContextSection title="Producten & Diensten" icon={ShoppingBag} badge={`${obs.products.length}`}>
              <div className="space-y-3">
                {obs.products.map((product: { name: string; description?: string; isBestseller?: boolean }, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-lg">
                    <ShoppingBag className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-surface-900">
                        {product.name}
                        {product.isBestseller && (
                          <Badge variant="default" className="ml-2 text-xs">Bestseller</Badge>
                        )}
                      </p>
                      {product.description && (
                        <p className="text-sm text-surface-600">{product.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ContextSection>
          )}

          {/* Brand Voice */}
          {brandVoice && (
            <ContextSection title="Brand Voice & Tone" icon={MessageSquare}>
              <div className="space-y-4">
                {brandVoice.toneOfVoice && (
                  <Field label="Tone of Voice">{brandVoice.toneOfVoice}</Field>
                )}
                {brandVoice.personality && brandVoice.personality.length > 0 && (
                  <Field label="Persoonlijkheid">
                    <div className="flex flex-wrap gap-1">
                      {brandVoice.personality.map((p: string, i: number) => (
                        <Badge key={i} variant="secondary">{p}</Badge>
                      ))}
                    </div>
                  </Field>
                )}
                {brandVoice.mustHaves && brandVoice.mustHaves.length > 0 && (
                  <Field label="Must-haves (DO's)">
                    <ul className="space-y-1">
                      {brandVoice.mustHaves.map((m: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </Field>
                )}
                {brandVoice.doNots && brandVoice.doNots.length > 0 && (
                  <Field label="Vermijden (DON'Ts)">
                    <ul className="space-y-1">
                      {brandVoice.doNots.map((d: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </Field>
                )}
              </div>
            </ContextSection>
          )}

          {/* Goals */}
          {context.goals && (
            <ContextSection title="Doelen" icon={Target}>
              <div className="space-y-4">
                {context.goals.primary && context.goals.primary.length > 0 && (
                  <Field label="Primaire doelen">
                    <ul className="space-y-1">
                      {context.goals.primary.map((g: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-primary mt-0.5" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </Field>
                )}
                {context.goals.marketing && (
                  <Field label="Marketing focus">
                    <div className="flex flex-wrap gap-2">
                      {context.goals.marketing.awareness && <Badge variant="outline">Awareness</Badge>}
                      {context.goals.marketing.leads && <Badge variant="outline">Leads</Badge>}
                      {context.goals.marketing.sales && <Badge variant="outline">Sales</Badge>}
                      {context.goals.marketing.retention && <Badge variant="outline">Retention</Badge>}
                    </div>
                  </Field>
                )}
              </div>
            </ContextSection>
          )}

          {/* Economics */}
          {context.economics && (
            <ContextSection title="Economics" icon={DollarSign}>
              <div className="grid gap-4 sm:grid-cols-2">
                {context.economics.priceRange && (
                  <Field label="Prijsrange">
                    {context.economics.priceRange.currency} {context.economics.priceRange.min} - {context.economics.priceRange.max}
                  </Field>
                )}
                {context.economics.seasonality && context.economics.seasonality.length > 0 && (
                  <Field label="Seizoensgebondenheid">
                    <div className="space-y-1">
                      {context.economics.seasonality.map((s: { period: string; impact: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{s.period}</span>
                          <Badge variant={s.impact === 'peak' ? 'default' : 'outline'} className="text-xs">
                            {s.impact}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            </ContextSection>
          )}

          {/* Competitors */}
          {context.competitors?.direct && context.competitors.direct.length > 0 && (
            <ContextSection title="Concurrenten" icon={Swords} badge={`${context.competitors.direct.length}`}>
              <div className="space-y-3">
                {context.competitors.direct.map((comp: { name: string; website?: string; positioning?: string }, i: number) => (
                  <div key={i} className="p-3 bg-surface-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-surface-900">{comp.name}</span>
                      {comp.website && (
                        <a href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          {comp.website} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {comp.positioning && (
                      <p className="text-sm text-surface-600 mt-1">{comp.positioning}</p>
                    )}
                  </div>
                ))}
              </div>
            </ContextSection>
          )}

          {/* Active Channels */}
          {context.access?.activeChannels && context.access.activeChannels.length > 0 && (
            <ContextSection title="Actieve Kanalen" icon={Megaphone}>
              <div className="flex flex-wrap gap-2">
                {context.access.activeChannels.map((channel: string, i: number) => (
                  <Badge key={i} variant="secondary" className="capitalize">
                    {channel.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </ContextSection>
          )}

          {/* Next Actions */}
          {context.nextActions && context.nextActions.length > 0 && (
            <ContextSection title="Aanbevolen Acties" icon={Lightbulb} badge={`${context.nextActions.length}`}>
              <div className="space-y-2">
                {context.nextActions.map((action: { id: string; title: string; priority: string; category: string }, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-lg">
                    <Lightbulb className={`h-5 w-5 mt-0.5 ${
                      action.priority === 'high' ? 'text-red-500' :
                      action.priority === 'medium' ? 'text-yellow-500' : 'text-surface-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-surface-900">{action.title}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{action.category}</Badge>
                        <Badge variant={action.priority === 'high' ? 'error' : 'secondary'} className="text-xs">
                          {action.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ContextSection>
          )}

          {/* Gaps & Questions */}
          {context.gaps && (
            <ContextSection title="Ontbrekende Informatie" icon={HelpCircle}>
              <div className="space-y-4">
                {context.gaps.critical && context.gaps.critical.length > 0 && (
                  <Field label="Kritieke gaps">
                    <ul className="space-y-2">
                      {context.gaps.critical.map((gap: { field: string; reason: string }, i: number) => (
                        <li key={i} className="p-2 bg-red-50 rounded-lg text-sm">
                          <span className="font-medium text-red-700">{gap.field}</span>
                          <p className="text-red-600">{gap.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </Field>
                )}
                {context.gaps.questionsToAsk && context.gaps.questionsToAsk.length > 0 && (
                  <Field label="Vragen om te stellen">
                    <ul className="space-y-2">
                      {context.gaps.questionsToAsk.map((q: { questionKey: string; questionText: string; priority: string }, i: number) => (
                        <li key={i} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg text-sm">
                          <HelpCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="text-yellow-800">{q.questionText}</p>
                            <Badge variant="outline" className="text-xs mt-1">{q.priority}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Field>
                )}
              </div>
            </ContextSection>
          )}

          {/* Missing Fields */}
          {context.confidence?.missingFields && context.confidence.missingFields.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Ontbrekende velden</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {context.confidence.missingFields.map((field: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-yellow-700 border-yellow-300 text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
