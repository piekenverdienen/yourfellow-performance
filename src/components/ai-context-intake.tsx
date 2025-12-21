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
  Zap,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  History,
  RotateCcw,
} from 'lucide-react'
import type { GetContextResponse, IntakeJob } from '@/lib/context/types'
import type { AIContext, ContextSummary } from '@/lib/context'

interface AIContextIntakeProps {
  clientId: string
  clientName: string
  canEdit: boolean
}

type IntakeStep = 'idle' | 'configuring' | 'running' | 'completed' | 'error'

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
  const [showDetails, setShowDetails] = useState(false)
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
      // Create job
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

      // Start processing
      const processRes = await fetch(`/api/intake-jobs/${jobData.jobId}/process`, {
        method: 'POST',
      })

      // Set job and start polling
      const statusRes = await fetch(`/api/intake-jobs/${jobData.jobId}`)
      const statusData = await statusRes.json()
      if (statusData.success) {
        setCurrentJob(statusData.job)
      }
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    }
  }

  // Fetch versions
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

  // Activate version
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

  // Idle state - no context yet
  if (step === 'idle' || step === 'configuring') {
    return (
      <div className="space-y-6">
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
                  <Button
                    variant="outline"
                    onClick={() => setStep('idle')}
                    className="flex-1"
                  >
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
      </div>
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

            {/* Progress bar */}
            <div className="max-w-md mx-auto">
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${currentJob.progress}%` }}
                />
              </div>
              <p className="text-sm text-surface-500 mt-2">{currentJob.progress}%</p>
            </div>

            {/* Steps */}
            <div className="flex justify-center gap-8 text-sm">
              {['scraping', 'analyzing', 'generating'].map((s, i) => {
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
              <h3 className="text-xl font-semibold text-surface-900">
                Er ging iets mis
              </h3>
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

  // Completed state - show context
  return (
    <div className="space-y-6">
      {/* Header with status */}
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
                  Versie {contextVersion} • Laatst bijgewerkt{' '}
                  {context?.lastUpdated &&
                    new Date(context.lastUpdated).toLocaleDateString('nl-NL')}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('configuring')}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Opnieuw
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Version history dropdown */}
          {showVersions && versions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100">
              <h4 className="text-sm font-medium text-surface-700 mb-2">
                Versie Geschiedenis
              </h4>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between p-2 bg-surface-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {v.isActive && (
                        <Badge variant="default" className="text-xs">
                          Actief
                        </Badge>
                      )}
                      <span className="text-sm text-surface-500">
                        {new Date(v.generatedAt).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    {!v.isActive && canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => activateVersion(v.version)}
                      >
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

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Samenvatting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-medium text-surface-900">{summary.oneLiner}</p>
            <p className="text-surface-600">{summary.shortDescription}</p>
            {summary.keyFacts && summary.keyFacts.length > 0 && (
              <ul className="space-y-1">
                {summary.keyFacts.map((fact: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-surface-700">
                    <span className="text-primary mt-1">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Context details */}
      {context && (
        <>
          {/* Business info */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Business Context
                </CardTitle>
                {showDetails ? (
                  <ChevronUp className="h-5 w-5 text-surface-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-surface-400" />
                )}
              </div>
            </CardHeader>
            {showDetails && (
              <CardContent className="space-y-4 pt-0">
                {context.observations.proposition && (
                  <div>
                    <label className="text-sm font-medium text-surface-500">
                      Propositie
                    </label>
                    <p className="text-surface-900">{context.observations.proposition}</p>
                  </div>
                )}

                {context.observations.targetAudience && (
                  <div>
                    <label className="text-sm font-medium text-surface-500">
                      Doelgroep
                    </label>
                    <p className="text-surface-900">
                      {typeof context.observations.targetAudience === 'string'
                        ? context.observations.targetAudience
                        : context.observations.targetAudience.primary}
                    </p>
                  </div>
                )}

                {context.observations.usps && context.observations.usps.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-surface-500">USPs</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {context.observations.usps.map((usp: { text: string; confidence: string }, i: number) => (
                        <Badge key={i} variant="secondary">
                          {usp.text}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {context.observations.brandVoice && (
                  <div>
                    <label className="text-sm font-medium text-surface-500">
                      Tone of Voice
                    </label>
                    <p className="text-surface-900">
                      {context.observations.brandVoice.toneOfVoice}
                    </p>
                  </div>
                )}

                {context.access?.activeChannels &&
                  context.access.activeChannels.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">
                        Actieve Kanalen
                      </label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {context.access.activeChannels.map((channel: string, i: number) => (
                          <Badge key={i} variant="outline">
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            )}
          </Card>

          {/* Confidence indicator */}
          {context.confidence && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Context Kwaliteit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
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
                  <span className="font-medium text-surface-900">
                    {Math.round(context.confidence.overall * 100)}%
                  </span>
                </div>

                {context.confidence.missingFields &&
                  context.confidence.missingFields.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-surface-500 mb-2">
                        Ontbrekende informatie:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {context.confidence.missingFields.slice(0, 5).map((field: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-yellow-600">
                            {field.split('.').pop()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
