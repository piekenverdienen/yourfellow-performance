'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Save,
  Settings,
  Megaphone,
} from 'lucide-react'

interface GoogleAdsSettings {
  customerId?: string
  monitoringEnabled?: boolean
  lastCheckAt?: string
}

interface GoogleAdsSetupProps {
  clientId: string
  currentSettings?: GoogleAdsSettings
  onSave?: (settings: GoogleAdsSettings | undefined) => Promise<void>
  disabled?: boolean
}

export function GoogleAdsSetup({
  clientId,
  currentSettings,
  onSave,
  disabled = false,
}: GoogleAdsSetupProps) {
  const [customerId, setCustomerId] = useState(currentSettings?.customerId || '')
  const [monitoringEnabled, setMonitoringEnabled] = useState(currentSettings?.monitoringEnabled !== false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasGlobalConfig, setHasGlobalConfig] = useState<boolean | null>(null)

  // Check if global Google Ads config exists
  useEffect(() => {
    async function checkGlobalConfig() {
      try {
        const res = await fetch('/api/settings/google-ads')
        if (res.ok) {
          const data = await res.json()
          setHasGlobalConfig(!!data.serviceAccountEmail && !!data.hasPrivateKey)
        } else {
          setHasGlobalConfig(false)
        }
      } catch {
        setHasGlobalConfig(false)
      }
    }
    checkGlobalConfig()
  }, [])

  // Format customer ID as user types (add dashes)
  const formatCustomerId = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Format as XXX-XXX-XXXX
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handleCustomerIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerId(formatCustomerId(e.target.value))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!onSave) return

    setSaving(true)
    try {
      if (customerId.replace(/-/g, '').length === 10) {
        await onSave({
          customerId: customerId.replace(/-/g, ''),
          monitoringEnabled,
        })
      } else if (!customerId) {
        await onSave(undefined)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      alert((error as Error).message || 'Fout bij opslaan')
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = !!currentSettings?.customerId
  const isValidCustomerId = customerId.replace(/-/g, '').length === 10 || customerId === ''

  return (
    <div className="space-y-4">
      {/* Global config warning */}
      {hasGlobalConfig === false && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Google Ads API niet geconfigureerd</p>
              <p className="text-sm text-amber-700 mt-1">
                Ga eerst naar{' '}
                <a href="/settings/google-ads" className="underline hover:text-amber-900">
                  Instellingen → Google Ads
                </a>{' '}
                om de API credentials in te stellen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Display */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {isConfigured ? (
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-surface-400" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-surface-900">
              {isConfigured ? 'Google Ads Monitoring Actief' : 'Google Ads niet geconfigureerd'}
            </p>
            <p className="text-sm text-surface-500">
              {isConfigured ? (
                <>Customer ID: {formatCustomerId(currentSettings.customerId!)}</>
              ) : (
                'Voer de Customer ID in om monitoring te activeren'
              )}
            </p>
          </div>
        </div>

        {isConfigured && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://ads.google.com', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open Google Ads
          </Button>
        )}
      </div>

      {/* Customer ID Input */}
      <div className="space-y-2">
        <label htmlFor="customerId" className="block text-sm font-medium text-surface-700">
          Google Ads Customer ID
        </label>
        <div className="flex gap-2">
          <Input
            id="customerId"
            type="text"
            placeholder="123-456-7890"
            value={customerId}
            onChange={handleCustomerIdChange}
            disabled={disabled || hasGlobalConfig === false}
            className={`font-mono ${!isValidCustomerId ? 'border-red-500' : ''}`}
            maxLength={12}
          />
          <Button
            onClick={handleSave}
            disabled={saving || disabled || !isValidCustomerId || hasGlobalConfig === false}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-surface-500">
          Te vinden rechtsboven in Google Ads (formaat: 123-456-7890)
        </p>
        {!isValidCustomerId && customerId && (
          <p className="text-xs text-red-500">
            Customer ID moet 10 cijfers zijn
          </p>
        )}
      </div>

      {/* Monitoring toggle */}
      {isConfigured && (
        <div className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-surface-900">Monitoring ingeschakeld</p>
            <p className="text-xs text-surface-500">
              Automatische checks elke 30 minuten
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={monitoringEnabled}
              onChange={(e) => {
                setMonitoringEnabled(e.target.checked)
                setSaved(false)
              }}
              className="sr-only peer"
              disabled={disabled}
            />
            <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      )}

      {/* Monitoring Status */}
      {isConfigured && hasGlobalConfig && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Monitoring Actief</p>
              <p className="text-sm text-green-700 mt-1">
                Dit account wordt automatisch gecontroleerd op afgekeurde advertenties
                en campagnes zonder impressies.
              </p>
              {currentSettings?.lastCheckAt && (
                <p className="text-xs text-green-600 mt-2">
                  Laatste check: {new Date(currentSettings.lastCheckAt).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info when not configured */}
      {!isConfigured && hasGlobalConfig && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Wat wordt gemonitord?</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Afgekeurde advertenties (policy violations)</li>
                <li>• Actieve campagnes zonder impressies</li>
                <li>• Kritieke issues verschijnen op het dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
