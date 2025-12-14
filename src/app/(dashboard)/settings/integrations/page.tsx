'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Integration, IntegrationProvider } from '@/types'
import {
  ArrowLeft,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

// Provider configurations
const PROVIDERS: {
  id: IntegrationProvider
  name: string
  description: string
  icon: string
  color: string
  scopes: string[]
  available: boolean
}[] = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Importeer campagnes, kosten en conversiedata',
    icon: '/icons/google-ads.svg',
    color: '#4285F4',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    available: true,
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook & Instagram advertentiedata',
    icon: '/icons/meta.svg',
    color: '#0081FB',
    scopes: ['ads_read'],
    available: false,
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Website verkeer en gedragsdata',
    icon: '/icons/google-analytics.svg',
    color: '#F9AB00',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    available: false,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM en marketing automation data',
    icon: '/icons/hubspot.svg',
    color: '#FF7A59',
    scopes: ['crm.objects.contacts.read'],
    available: false,
  },
]

function getStatusBadge(status: Integration['connection_status']) {
  switch (status) {
    case 'connected':
      return <Badge className="bg-green-100 text-green-700 border-green-200">Verbonden</Badge>
    case 'expired':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Verlopen</Badge>
    case 'error':
      return <Badge className="bg-red-100 text-red-700 border-red-200">Fout</Badge>
    default:
      return <Badge className="bg-surface-100 text-surface-600">In afwachting</Badge>
  }
}

function formatLastSync(date: string | undefined) {
  if (!date) return 'Nooit gesynchroniseerd'
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Zojuist'
  if (minutes < 60) return `${minutes} minuten geleden`
  if (hours < 24) return `${hours} uur geleden`
  return `${days} dagen geleden`
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchIntegrations()
  }, [])

  async function fetchIntegrations() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setIntegrations(data || [])
    } catch (error) {
      console.error('Error fetching integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect(provider: IntegrationProvider) {
    setConnecting(provider)
    try {
      // Redirect to OAuth flow
      const response = await fetch(`/api/integrations/${provider}/auth`)
      const data = await response.json()

      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || 'Could not start OAuth flow')
      }
    } catch (error) {
      console.error('Error connecting:', error)
      alert('Er ging iets mis bij het verbinden. Probeer het opnieuw.')
    } finally {
      setConnecting(null)
    }
  }

  async function handleSync(integrationId: string) {
    setSyncing(integrationId)
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      // Refresh integrations list
      await fetchIntegrations()
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Synchronisatie mislukt. Probeer het opnieuw.')
    } finally {
      setSyncing(null)
    }
  }

  async function handleDisconnect(integrationId: string) {
    if (!confirm('Weet je zeker dat je deze koppeling wilt verwijderen?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integrationId)

      if (error) throw error

      setIntegrations(prev => prev.filter(i => i.id !== integrationId))
    } catch (error) {
      console.error('Error disconnecting:', error)
      alert('Verwijderen mislukt. Probeer het opnieuw.')
    }
  }

  function getIntegrationForProvider(provider: IntegrationProvider) {
    return integrations.find(i => i.provider === provider)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-surface-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Koppelingen</h1>
          <p className="text-surface-600 mt-1">
            Verbind je advertentieplatforms om data te analyseren
          </p>
        </div>
      </div>

      {/* Connected integrations */}
      {integrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-surface-900">Actieve koppelingen</h2>
          {integrations.map((integration) => {
            const provider = PROVIDERS.find(p => p.id === integration.provider)
            if (!provider) return null

            return (
              <Card key={integration.id} className="border-green-200 bg-green-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Provider icon placeholder */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: provider.color }}
                    >
                      {provider.name.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900">
                          {provider.name}
                        </h3>
                        {getStatusBadge(integration.connection_status)}
                      </div>
                      <p className="text-sm text-surface-600 mt-0.5">
                        {integration.account_name || integration.account_id || 'Account gekoppeld'}
                      </p>
                      <p className="text-xs text-surface-500 mt-1">
                        {formatLastSync(integration.last_synced_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSync(integration.id)}
                        disabled={syncing === integration.id}
                      >
                        {syncing === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Sync</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {integration.last_error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{integration.last_error}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Available integrations */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">
          {integrations.length > 0 ? 'Meer koppelingen' : 'Beschikbare koppelingen'}
        </h2>

        <div className="grid gap-4">
          {PROVIDERS.map((provider) => {
            const existingIntegration = getIntegrationForProvider(provider.id)
            if (existingIntegration) return null

            return (
              <Card
                key={provider.id}
                className={!provider.available ? 'opacity-60' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Provider icon placeholder */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: provider.color }}
                    >
                      {provider.name.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900">
                          {provider.name}
                        </h3>
                        {!provider.available && (
                          <Badge className="bg-surface-100 text-surface-500">
                            Binnenkort
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-surface-600 mt-0.5">
                        {provider.description}
                      </p>
                    </div>

                    {provider.available ? (
                      <Button
                        onClick={() => handleConnect(provider.id)}
                        disabled={connecting === provider.id}
                      >
                        {connecting === provider.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verbinden...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Verbinden
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button disabled variant="secondary">
                        Binnenkort
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Help section */}
      <Card className="bg-surface-50 border-surface-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-surface-900 mb-2">
            Hoe werken koppelingen?
          </h3>
          <ul className="text-sm text-surface-600 space-y-2">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Klik op &quot;Verbinden&quot; om in te loggen bij het platform</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Geef Markifact toestemming om je data te lezen (alleen-lezen)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Data wordt automatisch gesynchroniseerd voor analyses</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Je kunt koppelingen op elk moment verwijderen</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
