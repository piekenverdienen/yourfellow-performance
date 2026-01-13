'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Save,
  Loader2,
  CheckCircle,
  Info,
  ExternalLink,
  ShoppingBag,
  Link2,
  Unlink,
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
  const [shopDomain, setShopDomain] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

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

  // Check URL params for OAuth result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shopifyStatus = params.get('shopify')
    const storeName = params.get('store')
    const shopifyError = params.get('shopify_error')

    if (shopifyStatus === 'connected' && storeName) {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (shopifyError) {
      alert(`Shopify verbinding mislukt: ${shopifyError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(settings)
    } catch (error) {
      console.error('Error saving Shopify settings:', error)
      alert('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const startOAuthFlow = () => {
    if (!shopDomain.trim()) {
      alert('Vul eerst je Shopify store domein in')
      return
    }

    setConnecting(true)

    // Normalize the shop domain
    let normalizedDomain = shopDomain.trim().toLowerCase()
    if (!normalizedDomain.includes('.myshopify.com')) {
      normalizedDomain = `${normalizedDomain}.myshopify.com`
    }
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')

    // Redirect to OAuth install endpoint
    window.location.href = `/api/shopify/oauth/install?shop=${encodeURIComponent(normalizedDomain)}&clientId=${encodeURIComponent(clientId)}`
  }

  const disconnectShopify = async () => {
    if (!confirm('Weet je zeker dat je de Shopify verbinding wilt verbreken?')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/shopify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (response.ok) {
        setSettings({
          enabled: false,
          storeId: '',
          accessToken: '',
          currency: 'EUR',
          timezone: 'Europe/Amsterdam',
          syncEnabled: true,
          thresholds: defaultThresholds,
        })
        await onSave(undefined)
      } else {
        const data = await response.json()
        alert(data.error || 'Kon verbinding niet verbreken')
      }
    } catch (error) {
      console.error('Error disconnecting Shopify:', error)
      alert('Er ging iets mis')
    } finally {
      setDisconnecting(false)
    }
  }

  const isConnected = settings.enabled && settings.storeId && settings.accessToken

  return (
    <div className="space-y-6">
      {/* Header */}
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
        {isConnected && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Verbonden
          </span>
        )}
      </div>

      {isConnected ? (
        /* Connected State */
        <>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">
                  Verbonden met: {settings.storeId}.myshopify.com
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Je Shopify store is succesvol gekoppeld. Orderdata wordt automatisch gesynchroniseerd.
                </p>
                {settings.lastSyncAt && (
                  <p className="text-xs text-green-600 mt-2">
                    Laatste sync: {new Date(settings.lastSyncAt).toLocaleString('nl-NL')}
                  </p>
                )}
              </div>
            </div>
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-surface-100">
            <Button
              type="button"
              onClick={handleSave}
              disabled={disabled || saving}
              className="bg-[#95BF47] hover:bg-[#95BF47]/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Instellingen Opslaan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={disconnectShopify}
              disabled={disabled || disconnecting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Verbinding Verbreken
            </Button>
          </div>
        </>
      ) : (
        /* Not Connected State */
        <>
          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Hoe werkt het?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Vul je Shopify store domein in (bijv. <code className="bg-blue-100 px-1 rounded">mijn-webshop</code>)</li>
                  <li>Klik op &quot;Verbinden met Shopify&quot;</li>
                  <li>Autoriseer de app in je Shopify admin</li>
                  <li>Je wordt automatisch teruggeleid</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Store Domain Input */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Shopify Store Domein
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value.trim().toLowerCase())}
                  placeholder="mijn-webshop"
                  disabled={disabled || connecting}
                  className="pr-32"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                  .myshopify.com
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Je vindt dit in je Shopify admin URL: admin.shopify.com/store/<strong>mijn-webshop</strong>
            </p>
          </div>

          {/* Connect Button */}
          <div className="pt-4 border-t border-surface-100">
            <Button
              type="button"
              onClick={startOAuthFlow}
              disabled={disabled || connecting || !shopDomain.trim()}
              className="bg-[#95BF47] hover:bg-[#95BF47]/90"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Verbinden met Shopify
            </Button>
          </div>

          {/* Help link */}
          <p className="text-xs text-surface-500">
            Problemen?{' '}
            <a
              href="https://help.shopify.com/en/manual/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#95BF47] hover:underline"
            >
              Bekijk de Shopify documentatie
              <ExternalLink className="inline h-3 w-3 ml-1" />
            </a>
          </p>
        </>
      )}
    </div>
  )
}
