'use client'

import { useState, useEffect, useRef } from 'react'
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
  RefreshCw,
  Target,
  TrendingUp,
  Building2,
} from 'lucide-react'
import type { MetaAdsSettings, MetaPerformanceTargets, MetaClientContext } from '@/types/meta-ads'

interface MetaAdsSetupProps {
  clientId: string
  currentSettings?: MetaAdsSettings
  onSave: (settings: MetaAdsSettings | undefined) => Promise<void>
  disabled?: boolean
}

const defaultThresholds = {
  frequencyWarning: 2.5,
  ctrDropWarning: 30,
  minSpendForAlert: 10,
}

const defaultTargets: MetaPerformanceTargets = {
  targetCPA: undefined,
  maxCPA: undefined,
  targetROAS: undefined,
  minROAS: undefined,
  targetCTR: undefined,
  dailyBudget: undefined,
  monthlyBudget: undefined,
  maxFrequency: 2.5,
}

const defaultContext: MetaClientContext = {
  industry: undefined,
  businessModel: undefined,
  averageOrderValue: undefined,
  targetMargin: undefined,
  notes: undefined,
}

const industries = [
  'E-commerce',
  'SaaS / Software',
  'Lead Generation',
  'App / Mobile',
  'Local Business',
  'B2B Services',
  'Retail',
  'Finance / Insurance',
  'Travel / Hospitality',
  'Health / Wellness',
  'Education',
  'Real Estate',
  'Other',
]

const businessModels = [
  'D2C (Direct to Consumer)',
  'B2B (Business to Business)',
  'B2C (Business to Consumer)',
  'Marketplace',
  'Subscription',
  'Lead Gen',
  'E-commerce Dropship',
  'E-commerce Private Label',
  'Agency',
  'Other',
]

export function MetaAdsSetup({
  clientId,
  currentSettings,
  onSave,
  disabled = false,
}: MetaAdsSetupProps) {
  const [settings, setSettings] = useState<MetaAdsSettings>(
    currentSettings || {
      enabled: false,
      adAccountId: '',
      accessToken: '',
      businessId: '',
      timezone: 'Europe/Amsterdam',
      currency: 'EUR',
      syncEnabled: true,
      thresholds: defaultThresholds,
    }
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Track if we've initialized from props to prevent overwriting user input
  const hasInitialized = useRef(false)

  // Only initialize from props once, when clientId changes
  useEffect(() => {
    // Reset initialization flag when clientId changes
    hasInitialized.current = false
  }, [clientId])

  useEffect(() => {
    // Only set settings from props if we haven't initialized yet
    if (!hasInitialized.current && currentSettings) {
      setSettings({
        ...currentSettings,
        thresholds: { ...defaultThresholds, ...currentSettings.thresholds },
        targets: { ...defaultTargets, ...currentSettings.targets },
        context: { ...defaultContext, ...currentSettings.context },
      })
      hasInitialized.current = true
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
      console.error('Error saving Meta Ads settings:', error)
      alert('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/meta-ads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: settings.accessToken,
          adAccountId: settings.adAccountId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: data.accountName
            ? `Verbonden met: ${data.accountName}`
            : 'Verbinding succesvol!',
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Verbinding mislukt',
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Netwerk fout - probeer opnieuw',
      })
    } finally {
      setTesting(false)
    }
  }

  const formatAdAccountId = (value: string) => {
    // Remove act_ prefix if user enters it
    const numericValue = value.replace(/^act_/, '').replace(/\D/g, '')
    return numericValue
  }

  const isValid =
    settings.enabled &&
    settings.adAccountId &&
    settings.accessToken

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <MarketingToolIcon tool="meta" size="lg" />
          <div>
            <p className="font-medium text-surface-900">Meta Ads Integratie</p>
            <p className="text-sm text-surface-500">
              Koppel Facebook & Instagram Ads voor performance inzichten
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
          <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1877F2]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1877F2]"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Ad Account ID */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Ad Account ID *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                  act_
                </span>
                <Input
                  value={settings.adAccountId?.replace(/^act_/, '') || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      adAccountId: formatAdAccountId(e.target.value),
                    }))
                  }
                  placeholder="123456789"
                  disabled={disabled}
                  className="pl-12"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Vind dit in{' '}
              <a
                href="https://business.facebook.com/settings/ad-accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1877F2] hover:underline inline-flex items-center gap-1"
              >
                Business Settings <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Access Token *
            </label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={settings.accessToken || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, accessToken: e.target.value }))
                }
                placeholder="EAAxxxxxx..."
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-sm"
              >
                {showToken ? 'Verberg' : 'Toon'}
              </button>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Genereer via{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1877F2] hover:underline inline-flex items-center gap-1"
              >
                Graph API Explorer <ExternalLink className="h-3 w-3" />
              </a>
              {' '}met ads_read en ads_management permissions
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={disabled || testing || !settings.adAccountId || !settings.accessToken}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Verbinding
            </Button>
            {testResult && (
              <span
                className={`text-sm flex items-center gap-1 ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {testResult.message}
              </span>
            )}
          </div>

          {/* Business ID (Optional) */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Business Manager ID (optioneel)
            </label>
            <Input
              value={settings.businessId || ''}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  businessId: e.target.value.replace(/\D/g, ''),
                }))
              }
              placeholder="360504898073937"
              disabled={disabled}
            />
            <p className="mt-1 text-xs text-surface-500">
              Nodig voor toegang tot meerdere ad accounts
            </p>
          </div>

          {/* Sync Settings */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
            <input
              type="checkbox"
              id="syncEnabled"
              checked={settings.syncEnabled !== false}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, syncEnabled: e.target.checked }))
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-surface-300 text-[#1877F2] focus:ring-[#1877F2]"
            />
            <label htmlFor="syncEnabled" className="text-sm text-surface-700">
              Automatische data sync inschakelen (dagelijks)
            </label>
          </div>

          {/* Performance Targets */}
          <div className="border border-purple-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTargets(!showTargets)}
              className="w-full p-4 bg-purple-50 hover:bg-purple-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-surface-900">Performance Targets</p>
                  <p className="text-sm text-surface-500">
                    Stel doelen in voor CPA, ROAS, budget
                  </p>
                </div>
              </div>
              <span className="text-purple-600 text-sm">
                {showTargets ? '▲ Verberg' : '▼ Toon'}
              </span>
            </button>

            {showTargets && (
              <div className="p-4 space-y-4 bg-white">
                {/* Cost Targets */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    Kosten Targets
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Target CPA (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settings.targets?.targetCPA ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              targetCPA: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 25.00"
                        disabled={disabled}
                      />
                      <p className="mt-1 text-xs text-surface-400">Ideale cost per aankoop</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Max CPA (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settings.targets?.maxCPA ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              maxCPA: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 40.00"
                        disabled={disabled}
                      />
                      <p className="mt-1 text-xs text-surface-400">Alert bij overschrijding</p>
                    </div>
                  </div>
                </div>

                {/* ROAS Targets */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    ROAS Targets
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Target ROAS
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.targets?.targetROAS ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              targetROAS: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 3.0"
                        disabled={disabled}
                      />
                      <p className="mt-1 text-xs text-surface-400">3.0 = €3 omzet per €1 spend</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Minimum ROAS
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.targets?.minROAS ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              minROAS: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 1.5"
                        disabled={disabled}
                      />
                      <p className="mt-1 text-xs text-surface-400">Alert bij onderschrijding</p>
                    </div>
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Budget
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Dagbudget (€)
                      </label>
                      <Input
                        type="number"
                        step="1"
                        value={settings.targets?.dailyBudget ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              dailyBudget: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 500"
                        disabled={disabled}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Maandbudget (€)
                      </label>
                      <Input
                        type="number"
                        step="1"
                        value={settings.targets?.monthlyBudget ?? ''}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              monthlyBudget: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          }))
                        }
                        placeholder="bv. 15000"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    Frequency Limiet
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Max Frequency
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.targets?.maxFrequency ?? 2.5}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            targets: {
                              ...prev.targets,
                              maxFrequency: e.target.value ? parseFloat(e.target.value) : 2.5,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={1}
                        max={10}
                      />
                      <p className="mt-1 text-xs text-surface-400">Fatigue alert bij overschrijding</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Client Context */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="w-full p-4 bg-blue-50 hover:bg-blue-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-surface-900">Business Context</p>
                  <p className="text-sm text-surface-500">
                    Industrie, marge, seizoen - voor slimmere AI adviezen
                  </p>
                </div>
              </div>
              <span className="text-blue-600 text-sm">
                {showContext ? '▲ Verberg' : '▼ Toon'}
              </span>
            </button>

            {showContext && (
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Industrie
                    </label>
                    <select
                      value={settings.context?.industry ?? ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          context: {
                            ...prev.context,
                            industry: e.target.value || undefined,
                          },
                        }))
                      }
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Selecteer...</option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Business Model
                    </label>
                    <select
                      value={settings.context?.businessModel ?? ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          context: {
                            ...prev.context,
                            businessModel: e.target.value || undefined,
                          },
                        }))
                      }
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Selecteer...</option>
                      {businessModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Gemiddelde orderwaarde (€)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.context?.averageOrderValue ?? ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          context: {
                            ...prev.context,
                            averageOrderValue: e.target.value ? parseFloat(e.target.value) : undefined,
                          },
                        }))
                      }
                      placeholder="bv. 75.00"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Target marge (%)
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={settings.context?.targetMargin ?? ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          context: {
                            ...prev.context,
                            targetMargin: e.target.value ? parseFloat(e.target.value) : undefined,
                          },
                        }))
                      }
                      placeholder="bv. 40"
                      disabled={disabled}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">
                    Seizoensgebondenheid
                  </label>
                  <Input
                    value={settings.context?.seasonality ?? ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        context: {
                          ...prev.context,
                          seasonality: e.target.value || undefined,
                        },
                      }))
                    }
                    placeholder="bv. Q4 piek, zomer rustig"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">
                    Notities voor AI analyse
                  </label>
                  <textarea
                    value={settings.context?.notes ?? ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        context: {
                          ...prev.context,
                          notes: e.target.value || undefined,
                        },
                      }))
                    }
                    placeholder="bv. Focus op nieuw product launch, marge is lager dan normaal, etc."
                    disabled={disabled}
                    rows={3}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  />
                  <p className="mt-1 text-xs text-surface-400">
                    Deze context wordt meegegeven aan de AI voor relevantere adviezen
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-[#1877F2] hover:text-[#1877F2]/80 flex items-center gap-1"
            >
              <Info className="h-4 w-4" />
              {showAdvanced ? 'Verberg' : 'Toon'} geavanceerde instellingen
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-surface-50 rounded-lg space-y-4">
                {/* Timezone & Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Timezone
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                      }
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-[#1877F2] focus:border-[#1877F2] text-sm"
                    >
                      <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">
                      Valuta
                    </label>
                    <select
                      value={settings.currency}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-[#1877F2] focus:border-[#1877F2] text-sm"
                    >
                      <option value="EUR">EUR (Euro)</option>
                      <option value="USD">USD (Dollar)</option>
                      <option value="GBP">GBP (Pound)</option>
                    </select>
                  </div>
                </div>

                {/* Fatigue Thresholds */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-2">
                    Creative Fatigue Drempels
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Frequency warning
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.thresholds?.frequencyWarning ?? 2.5}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              frequencyWarning: parseFloat(e.target.value) || 2.5,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={1}
                        max={10}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        CTR drop (%)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.ctrDropWarning ?? 30}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              ctrDropWarning: parseInt(e.target.value) || 30,
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
                        Min. spend (EUR)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.minSpendForAlert ?? 10}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              minSpendForAlert: parseInt(e.target.value) || 10,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={0}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">
                    Fatigue alerts worden getriggerd bij frequency &gt; {settings.thresholds?.frequencyWarning},
                    CTR drop &gt; {settings.thresholds?.ctrDropWarning}%, en spend &gt; {settings.thresholds?.minSpendForAlert} EUR.
                  </p>
                </div>

                {/* Pixel ID */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1">
                    Meta Pixel ID (optioneel)
                  </label>
                  <Input
                    value={settings.pixelId || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        pixelId: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="123456789"
                    disabled={disabled}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Last Sync Info */}
          {settings.lastSyncAt && (
            <div className="text-xs text-surface-500">
              Laatste sync: {new Date(settings.lastSyncAt).toLocaleString('nl-NL')}
            </div>
          )}

          {/* Validation Messages */}
          {settings.enabled && !settings.adAccountId && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een Ad Account ID in
            </div>
          )}

          {settings.enabled && !settings.accessToken && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een Access Token in
            </div>
          )}

          {isValid && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Configuratie compleet - test de verbinding voor het opslaan
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t border-surface-100">
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving || (settings.enabled && !isValid)}
          className="bg-[#1877F2] hover:bg-[#1877F2]/90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {settings.enabled ? 'Meta Ads Opslaan' : 'Meta Ads Uitschakelen'}
        </Button>
      </div>
    </div>
  )
}
