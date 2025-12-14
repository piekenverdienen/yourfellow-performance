'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Save,
  Loader2,
  Plus,
  X,
  Target,
  Megaphone,
  ShieldAlert,
  Zap,
  TrendingUp,
} from 'lucide-react'
import type { ClientContext, ChannelType } from '@/types'

interface ClientContextFormProps {
  clientId: string
  initialContext?: ClientContext
  canEdit: boolean
  onSave?: (context: ClientContext) => void
}

const defaultContext: ClientContext = {
  proposition: '',
  targetAudience: '',
  usps: [],
  toneOfVoice: '',
  brandVoice: '',
  doNots: [],
  mustHaves: [],
  activeChannels: [],
}

const channelOptions: { value: ChannelType; label: string }[] = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'seo', label: 'SEO' },
  { value: 'klaviyo', label: 'Klaviyo (Email)' },
  { value: 'cro', label: 'CRO' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
]

export function ClientContextForm({
  clientId,
  initialContext,
  canEdit,
  onSave,
}: ClientContextFormProps) {
  const [context, setContext] = useState<ClientContext>(
    initialContext || defaultContext
  )
  const [saving, setSaving] = useState(false)
  const [newUsp, setNewUsp] = useState('')
  const [newDoNot, setNewDoNot] = useState('')
  const [newMustHave, setNewMustHave] = useState('')
  const [newBestseller, setNewBestseller] = useState('')
  const [newSeasonality, setNewSeasonality] = useState('')

  useEffect(() => {
    if (initialContext) {
      setContext(initialContext)
    }
  }, [initialContext])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { context },
        }),
      })

      if (res.ok) {
        onSave?.(context)
        alert('Context opgeslagen')
      } else {
        const data = await res.json()
        alert(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error saving context:', error)
      alert('Er ging iets mis')
    } finally {
      setSaving(false)
    }
  }

  const addToArray = (
    field: 'usps' | 'doNots' | 'mustHaves' | 'bestsellers' | 'seasonality',
    value: string,
    clearFn: (v: string) => void
  ) => {
    if (!value.trim()) return
    setContext((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()],
    }))
    clearFn('')
  }

  const removeFromArray = (
    field: 'usps' | 'doNots' | 'mustHaves' | 'bestsellers' | 'seasonality',
    index: number
  ) => {
    setContext((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }))
  }

  const toggleChannel = (channel: ChannelType) => {
    setContext((prev) => ({
      ...prev,
      activeChannels: prev.activeChannels.includes(channel)
        ? prev.activeChannels.filter((c) => c !== channel)
        : [...prev.activeChannels, channel],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Propositie & Doelgroep */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Business Informatie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Propositie
            </label>
            <textarea
              value={context.proposition}
              onChange={(e) =>
                setContext((prev) => ({ ...prev, proposition: e.target.value }))
              }
              placeholder="Wat biedt deze klant? Wat is hun core business?"
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Doelgroep
            </label>
            <textarea
              value={context.targetAudience}
              onChange={(e) =>
                setContext((prev) => ({
                  ...prev,
                  targetAudience: e.target.value,
                }))
              }
              placeholder="Wie is de ideale klant? Demografisch, psychografisch, pains & gains"
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              disabled={!canEdit}
            />
          </div>

          {/* USPs */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              USP&apos;s (Unique Selling Points)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {context.usps.map((usp, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {usp}
                  {canEdit && (
                    <button
                      onClick={() => removeFromArray('usps', index)}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newUsp}
                  onChange={(e) => setNewUsp(e.target.value)}
                  placeholder="Bijv: Gratis verzending vanaf €50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToArray('usps', newUsp, setNewUsp)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToArray('usps', newUsp, setNewUsp)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Bestsellers */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Bestsellers / Hero producten
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(context.bestsellers || []).map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                >
                  {item}
                  {canEdit && (
                    <button
                      onClick={() => removeFromArray('bestsellers', index)}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newBestseller}
                  onChange={(e) => setNewBestseller(e.target.value)}
                  placeholder="Bijv: Nike Air Max 90"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToArray('bestsellers', newBestseller, setNewBestseller)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addToArray('bestsellers', newBestseller, setNewBestseller)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Seasonality */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Seizoensgebonden momenten
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(context.seasonality || []).map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {item}
                  {canEdit && (
                    <button
                      onClick={() => removeFromArray('seasonality', index)}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newSeasonality}
                  onChange={(e) => setNewSeasonality(e.target.value)}
                  placeholder="Bijv: Black Friday, Zomersale"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToArray('seasonality', newSeasonality, setNewSeasonality)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addToArray('seasonality', newSeasonality, setNewSeasonality)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Margins */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Marges (optioneel)
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-surface-500">Minimum %</label>
                <Input
                  type="number"
                  value={context.margins?.min || ''}
                  onChange={(e) =>
                    setContext((prev) => ({
                      ...prev,
                      margins: {
                        min: parseFloat(e.target.value) || 0,
                        target: prev.margins?.target || 0,
                      },
                    }))
                  }
                  placeholder="15"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-surface-500">Target %</label>
                <Input
                  type="number"
                  value={context.margins?.target || ''}
                  onChange={(e) =>
                    setContext((prev) => ({
                      ...prev,
                      margins: {
                        min: prev.margins?.min || 0,
                        target: parseFloat(e.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="25"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Voice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Merkidentiteit & Tone of Voice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Tone of Voice
            </label>
            <textarea
              value={context.toneOfVoice}
              onChange={(e) =>
                setContext((prev) => ({ ...prev, toneOfVoice: e.target.value }))
              }
              placeholder="Hoe communiceert dit merk? Formeel/informeel, speels/serieus, etc."
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Brand Voice / Personality
            </label>
            <textarea
              value={context.brandVoice}
              onChange={(e) =>
                setContext((prev) => ({ ...prev, brandVoice: e.target.value }))
              }
              placeholder="Wat zijn de kernwaarden? Als het merk een persoon was, hoe zou die zijn?"
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance / Do's & Don'ts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Compliance & Regels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Do Nots */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Don&apos;ts (verboden claims/woorden)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {context.doNots.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                >
                  {item}
                  {canEdit && (
                    <button
                      onClick={() => removeFromArray('doNots', index)}
                      className="hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newDoNot}
                  onChange={(e) => setNewDoNot(e.target.value)}
                  placeholder="Bijv: 'beste', 'goedkoopste', gezondheidsclains"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToArray('doNots', newDoNot, setNewDoNot)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToArray('doNots', newDoNot, setNewDoNot)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Must Haves */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Must-haves (verplichte disclaimers/teksten)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {context.mustHaves.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {item}
                  {canEdit && (
                    <button
                      onClick={() => removeFromArray('mustHaves', index)}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newMustHave}
                  onChange={(e) => setNewMustHave(e.target.value)}
                  placeholder="Bijv: '© 2024', 'Actie geldig t/m...'"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToArray('mustHaves', newMustHave, setNewMustHave)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addToArray('mustHaves', newMustHave, setNewMustHave)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Actieve Kanalen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {channelOptions.map((channel) => (
              <button
                key={channel.value}
                onClick={() => canEdit && toggleChannel(channel.value)}
                disabled={!canEdit}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  context.activeChannels.includes(channel.value)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-surface-200 text-surface-600 hover:border-surface-300'
                } ${!canEdit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span className="font-medium">{channel.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Context Opslaan
          </Button>
        </div>
      )}
    </div>
  )
}
