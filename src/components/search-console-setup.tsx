'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarketingToolIcon } from '@/components/marketing-tool-icon'
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
} from 'lucide-react'
import type { SearchConsoleSettings } from '@/types'

interface SearchConsoleSetupProps {
  clientId: string
  currentSettings?: SearchConsoleSettings
  onSave: (settings: SearchConsoleSettings | undefined) => Promise<void>
  disabled?: boolean
}

export function SearchConsoleSetup({
  clientId,
  currentSettings,
  onSave,
  disabled = false,
}: SearchConsoleSetupProps) {
  const [settings, setSettings] = useState<SearchConsoleSettings>(
    currentSettings || {
      enabled: false,
      siteUrl: '',
      dateRangeDays: 28,
    }
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    if (currentSettings) {
      setSettings({
        enabled: currentSettings.enabled ?? false,
        siteUrl: currentSettings.siteUrl ?? '',
        dateRangeDays: currentSettings.dateRangeDays ?? 28,
      })
    }
  }, [currentSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!settings.enabled) {
        await onSave(undefined)
      } else {
        await onSave(settings)
      }
    } catch (error) {
      console.error('Error saving Search Console settings:', error)
      alert('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!settings.siteUrl) return

    setTesting(true)
    setTestResult(null)
    setTestError(null)

    try {
      const response = await fetch('/api/seo/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: settings.siteUrl }),
      })

      const data = await response.json()

      if (data.success) {
        setTestResult('success')
      } else {
        setTestResult('error')
        setTestError(data.error || 'Verbinding mislukt')
      }
    } catch {
      setTestResult('error')
      setTestError('Kon geen verbinding maken')
    } finally {
      setTesting(false)
    }
  }

  const isValidUrl = (url: string) => {
    if (url.startsWith('sc-domain:')) return true
    try {
      new URL(url)
      return url.endsWith('/')
    } catch {
      return false
    }
  }

  const urlValid = settings.siteUrl ? isValidUrl(settings.siteUrl) : false

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <MarketingToolIcon tool="search-console" size="lg" />
          <div>
            <p className="font-medium text-surface-900">Search Console Koppeling</p>
            <p className="text-sm text-surface-500">
              Gebruik Search Console data voor SEO-analyse
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
            }
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Site URL */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Search Console Property URL *
            </label>
            <div className="flex gap-2">
              <Input
                value={settings.siteUrl || ''}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, siteUrl: e.target.value }))
                  setTestResult(null)
                }}
                placeholder="https://example.nl/ of sc-domain:example.nl"
                disabled={disabled}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={disabled || testing || !settings.siteUrl || !urlValid}
                className="shrink-0"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-surface-500">
              Vind dit in{' '}
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Google Search Console
                <ExternalLink className="h-3 w-3" />
              </a>
              . Gebruik de volledige URL met trailing slash (https://site.nl/) of domain property (sc-domain:site.nl)
            </p>
          </div>

          {/* URL Format Help */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Property URL formaat:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                  <li><code className="bg-blue-100 px-1 rounded">https://example.nl/</code> - URL prefix property</li>
                  <li><code className="bg-blue-100 px-1 rounded">sc-domain:example.nl</code> - Domain property</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Test Result */}
          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              Verbinding succesvol! Search Console data is beschikbaar.
            </div>
          )}

          {testResult === 'error' && (
            <div className="flex items-start gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Verbinding mislukt</p>
                <p className="text-red-500">{testError}</p>
                <p className="mt-2 text-xs">
                  Controleer of het service account is toegevoegd aan deze Search Console property met &quot;Volledige&quot; rechten.
                </p>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Analyse periode (dagen)
            </label>
            <select
              value={settings.dateRangeDays}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  dateRangeDays: parseInt(e.target.value),
                }))
              }
              disabled={disabled}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={7}>Laatste 7 dagen</option>
              <option value={14}>Laatste 14 dagen</option>
              <option value={28}>Laatste 28 dagen (aanbevolen)</option>
              <option value={90}>Laatste 90 dagen</option>
            </select>
            <p className="mt-1 text-xs text-surface-500">
              Periode voor het ophalen van zoekdata. Meer dagen = meer data maar langzamere analyse.
            </p>
          </div>

          {/* Validation */}
          {settings.enabled && !settings.siteUrl && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een Search Console property URL in
            </div>
          )}

          {settings.enabled && settings.siteUrl && !urlValid && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              URL moet eindigen met / of beginnen met sc-domain:
            </div>
          )}

          {settings.enabled && urlValid && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Configuratie compleet - klik op Test om de verbinding te controleren
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t border-surface-100">
        <Button
          onClick={handleSave}
          disabled={disabled || saving || (settings.enabled && (!settings.siteUrl || !urlValid))}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {settings.enabled ? 'Search Console Opslaan' : 'Search Console Uitschakelen'}
        </Button>
      </div>
    </div>
  )
}
