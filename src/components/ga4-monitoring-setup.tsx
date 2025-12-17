'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Save,
  Loader2,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react'
import type { GA4MonitoringSettings } from '@/types'

interface GA4MonitoringSetupProps {
  clientId: string
  currentSettings?: GA4MonitoringSettings
  onSave: (settings: GA4MonitoringSettings | undefined) => Promise<void>
  disabled?: boolean
}

const defaultMetrics = {
  sessions: true,
  totalUsers: true,
  engagementRate: true,
  conversions: false,
  purchaseRevenue: false,
}

const defaultThresholds = {
  warning: 20,
  critical: 40,
  minBaseline: 20,
}

export function GA4MonitoringSetup({
  clientId,
  currentSettings,
  onSave,
  disabled = false,
}: GA4MonitoringSetupProps) {
  const [settings, setSettings] = useState<GA4MonitoringSettings>(
    currentSettings || {
      enabled: false,
      propertyId: '',
      timezone: 'Europe/Amsterdam',
      metrics: defaultMetrics,
      thresholds: defaultThresholds,
    }
  )
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (currentSettings) {
      setSettings({
        ...currentSettings,
        metrics: { ...defaultMetrics, ...currentSettings.metrics },
        thresholds: { ...defaultThresholds, ...currentSettings.thresholds },
      })
    }
  }, [currentSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      // If disabled, clear settings
      if (!settings.enabled) {
        await onSave(undefined)
      } else {
        await onSave(settings)
      }
    } catch (error) {
      console.error('Error saving GA4 settings:', error)
      alert('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const toggleMetric = (metric: keyof typeof defaultMetrics) => {
    setSettings((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [metric]: !prev.metrics?.[metric],
      },
    }))
  }

  const needsKeyEvent = settings.metrics?.conversions

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-surface-900">GA4 Anomaly Monitoring</p>
            <p className="text-sm text-surface-500">
              Ontvang automatisch alerts bij afwijkende metrics
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
          <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* GA4 Property ID */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              GA4 Property ID *
            </label>
            <Input
              value={settings.propertyId || ''}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  propertyId: e.target.value.replace(/\D/g, ''),
                }))
              }
              placeholder="123456789"
              disabled={disabled}
            />
            <p className="mt-1 text-xs text-surface-500">
              Vind dit in GA4 onder Admin &gt; Property Settings
            </p>
          </div>

          {/* Metrics Selection */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-3">
              Metrics om te monitoren
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'sessions', label: 'Sessions', description: 'Aantal sessies' },
                { key: 'totalUsers', label: 'Users', description: 'Unieke gebruikers' },
                { key: 'engagementRate', label: 'Engagement', description: 'Engagement rate' },
                { key: 'conversions', label: 'Conversies', description: 'Key event conversies' },
                { key: 'purchaseRevenue', label: 'Revenue', description: 'E-commerce omzet' },
              ].map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => !disabled && toggleMetric(metric.key as keyof typeof defaultMetrics)}
                  disabled={disabled}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    settings.metrics?.[metric.key as keyof typeof defaultMetrics]
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-surface-200 text-surface-600 hover:border-surface-300'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <span className="font-medium block">{metric.label}</span>
                  <span className="text-xs opacity-70">{metric.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Key Event Name (required for conversions) */}
          {needsKeyEvent && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Key Event Naam *
              </label>
              <Input
                value={settings.keyEventName || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, keyEventName: e.target.value }))
                }
                placeholder="purchase"
                disabled={disabled}
              />
              <p className="mt-1 text-xs text-surface-500">
                De event naam in GA4 die je als conversie wilt tracken
              </p>
            </div>
          )}

          {/* E-commerce Toggle */}
          {settings.metrics?.purchaseRevenue && (
            <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
              <input
                type="checkbox"
                id="isEcommerce"
                checked={settings.isEcommerce}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, isEcommerce: e.target.checked }))
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-surface-300 text-primary focus:ring-primary"
              />
              <label htmlFor="isEcommerce" className="text-sm text-surface-700">
                Dit is een e-commerce klant (revenue = 0 triggert CRITICAL alert)
              </label>
            </div>
          )}

          {/* Advanced Settings */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
            >
              <Info className="h-4 w-4" />
              {showAdvanced ? 'Verberg' : 'Toon'} geavanceerde instellingen
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-surface-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                    }
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Warning drempel (%)
                    </label>
                    <Input
                      type="number"
                      value={settings.thresholds?.warning ?? 20}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            warning: parseInt(e.target.value) || 20,
                          },
                        }))
                      }
                      disabled={disabled}
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Critical drempel (%)
                    </label>
                    <Input
                      type="number"
                      value={settings.thresholds?.critical ?? 40}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            critical: parseInt(e.target.value) || 40,
                          },
                        }))
                      }
                      disabled={disabled}
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Min. baseline
                    </label>
                    <Input
                      type="number"
                      value={settings.thresholds?.minBaseline ?? 20}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          thresholds: {
                            ...prev.thresholds,
                            minBaseline: parseInt(e.target.value) || 20,
                          },
                        }))
                      }
                      disabled={disabled}
                      min={0}
                    />
                  </div>
                </div>

                <p className="text-xs text-surface-500">
                  Alerts worden getriggerd bij afwijkingen van {settings.thresholds?.warning}% (warning)
                  of {settings.thresholds?.critical}% (critical) t.o.v. het 7-dagen gemiddelde.
                  Geen alerts als de baseline onder {settings.thresholds?.minBaseline} ligt.
                </p>
              </div>
            )}
          </div>

          {/* Validation Messages */}
          {settings.enabled && !settings.propertyId && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een GA4 Property ID in om monitoring te activeren
            </div>
          )}

          {needsKeyEvent && !settings.keyEventName && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een key event naam in voor conversie tracking
            </div>
          )}

          {settings.enabled && settings.propertyId && (!needsKeyEvent || settings.keyEventName) && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Configuratie compleet - monitoring wordt actief na opslaan
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t border-surface-100">
        <Button
          onClick={handleSave}
          disabled={
            disabled ||
            saving ||
            (settings.enabled && !settings.propertyId) ||
            (settings.enabled && needsKeyEvent && !settings.keyEventName)
          }
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {settings.enabled ? 'Monitoring Opslaan' : 'Monitoring Uitschakelen'}
        </Button>
      </div>
    </div>
  )
}
