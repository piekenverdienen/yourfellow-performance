'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import type { ShopifySettings } from '@/types'

interface ShopifySetupProps {
  clientId: string
  currentSettings?: ShopifySettings
  onSave: (settings: ShopifySettings | undefined) => Promise<void>
  disabled?: boolean
}

const defaultThresholds = {
  revenueDropWarning: 20,
  revenueDropCritical: 40,
  ordersDropWarning: 25,
  ordersDropCritical: 50,
  highRefundRate: 10,
}

export function ShopifySetup({
  clientId,
  currentSettings,
  onSave,
  disabled = false,
}: ShopifySetupProps) {
  const [settings, setSettings] = useState<ShopifySettings>(
    currentSettings || {
      enabled: false,
      storeId: '',
      accessToken: '',
      currency: 'EUR',
      timezone: 'Europe/Amsterdam',
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
  const [showToken, setShowToken] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Track if we've initialized from props
  const hasInitialized = useRef(false)

  useEffect(() => {
    hasInitialized.current = false
  }, [clientId])

  useEffect(() => {
    if (!hasInitialized.current && currentSettings) {
      setSettings({
        ...currentSettings,
        thresholds: { ...defaultThresholds, ...currentSettings.thresholds },
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
      console.error('Error saving Shopify settings:', error)
      alert('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/shopify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          storeId: settings.storeId,
          accessToken: settings.accessToken,
          currency: settings.currency,
          timezone: settings.timezone,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: data.storeName
            ? `Verbonden met: ${data.storeName}`
            : 'Verbinding succesvol!',
        })
        // Update settings to mark as enabled since connection was successful
        setSettings((prev) => ({ ...prev, enabled: true }))
      } else {
        setTestResult({
          success: false,
          message: data.error || data.details || 'Verbinding mislukt',
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

  const isValid = settings.enabled && settings.storeId && settings.accessToken

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-5 w-5 text-[#95BF47]" />
          <div>
            <p className="font-medium text-surface-900">Shopify Integratie</p>
            <p className="text-sm text-surface-500">
              Koppel je Shopify store voor omzet en order inzichten
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
          <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#95BF47]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#95BF47]"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Instructions Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Hoe krijg je deze gegevens?</p>
                <ol className="list-decimal list-inside space-y-2 text-blue-700">
                  <li>
                    <strong>Store ID</strong>: Dit is je Shopify store subdomain.<br />
                    <span className="text-xs">Voorbeeld: als je admin URL is{' '}
                    <code className="bg-blue-100 px-1 rounded">
                      https://admin.shopify.com/store/<strong>mijn-webshop</strong>
                    </code>{' '}
                    dan is je Store ID:{' '}
                    <code className="bg-blue-100 px-1 rounded font-bold">mijn-webshop</code></span>
                  </li>
                  <li>
                    <strong>Access Token</strong>: Maak een <em>Custom App</em> in je store:<br />
                    <span className="text-xs">
                      Ga naar{' '}
                      <a
                        href="https://admin.shopify.com/store"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-900"
                      >
                        Settings &rarr; Apps and sales channels &rarr; Develop apps
                        <ExternalLink className="inline h-3 w-3 ml-1" />
                      </a>
                    </span>
                  </li>
                  <li>
                    <span className="text-xs">Maak een nieuwe custom app met scopes:{' '}
                    <code className="bg-blue-100 px-1 rounded">read_orders</code> en{' '}
                    <code className="bg-blue-100 px-1 rounded">read_customers</code></span>
                  </li>
                  <li>
                    <span className="text-xs">Installeer de app en kopieer de <strong>Admin API access token</strong> (begint met{' '}
                    <code className="bg-blue-100 px-1 rounded">shpat_</code>)</span>
                  </li>
                </ol>
                <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-amber-800 text-xs">
                  <strong>Let op:</strong> Je hebt de <em>Admin API access token</em> nodig van een custom app in je store,
                  niet de Partner API token. De Partner API is alleen voor Partner Dashboard data.
                </div>
              </div>
            </div>
          </div>

          {/* Store ID */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Store ID *
            </label>
            <Input
              value={settings.storeId || ''}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  storeId: e.target.value.trim().toLowerCase(),
                }))
              }
              placeholder="mijn-webshop"
              disabled={disabled}
            />
            <p className="mt-1 text-xs text-surface-500">
              Je store subdomain, bijv. <code className="bg-surface-100 px-1 rounded">mijn-webshop</code> van{' '}
              <code className="bg-surface-100 px-1 rounded">mijn-webshop.myshopify.com</code>
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
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
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
              Admin API access token - begint met <code className="bg-surface-100 px-1 rounded">shpat_</code>
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={disabled || testing || !settings.storeId || !settings.accessToken}
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
              className="h-4 w-4 rounded border-surface-300 text-[#95BF47] focus:ring-[#95BF47]"
            />
            <label htmlFor="syncEnabled" className="text-sm text-surface-700">
              Automatische data sync inschakelen (dagelijks)
            </label>
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-[#95BF47] hover:text-[#95BF47]/80 flex items-center gap-1"
            >
              <Info className="h-4 w-4" />
              {showAdvanced ? 'Verberg' : 'Toon'} geavanceerde instellingen
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-surface-50 rounded-lg space-y-4">
                {/* Currency & Timezone */}
                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-[#95BF47] focus:border-[#95BF47] text-sm"
                    >
                      <option value="EUR">EUR (Euro)</option>
                      <option value="USD">USD (Dollar)</option>
                      <option value="GBP">GBP (Pound)</option>
                    </select>
                  </div>
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
                      className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-[#95BF47] focus:border-[#95BF47] text-sm"
                    >
                      <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>

                {/* Alert Thresholds */}
                <div>
                  <p className="text-sm font-medium text-surface-700 mb-2">
                    Alert Drempels
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Omzet drop warning (%)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.revenueDropWarning ?? 20}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              revenueDropWarning: parseInt(e.target.value) || 20,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={5}
                        max={50}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Omzet drop critical (%)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.revenueDropCritical ?? 40}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              revenueDropCritical: parseInt(e.target.value) || 40,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={20}
                        max={80}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Orders drop warning (%)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.ordersDropWarning ?? 25}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              ordersDropWarning: parseInt(e.target.value) || 25,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={5}
                        max={50}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Hoge refund rate (%)
                      </label>
                      <Input
                        type="number"
                        value={settings.thresholds?.highRefundRate ?? 10}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              highRefundRate: parseInt(e.target.value) || 10,
                            },
                          }))
                        }
                        disabled={disabled}
                        min={1}
                        max={30}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">
                    Je ontvangt alerts wanneer deze drempels worden overschreden
                  </p>
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
          {settings.enabled && !settings.storeId && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een Store ID in
            </div>
          )}

          {settings.enabled && !settings.accessToken && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Vul een Access Token in
            </div>
          )}

          {isValid && testResult?.success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Shopify verbinding actief
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
          className="bg-[#95BF47] hover:bg-[#95BF47]/90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {settings.enabled ? 'Shopify Opslaan' : 'Shopify Uitschakelen'}
        </Button>
      </div>
    </div>
  )
}
