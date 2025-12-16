'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Building2,
  Users,
  Loader2,
  Search,
  Settings,
  ExternalLink,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { ClientLogoFallback } from '@/components/logo-upload'
import type { ClientWithRole } from '@/types'

export default function ClientsPage() {
  const { user } = useUser()
  const [clients, setClients] = useState<ClientWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientDescription, setNewClientDescription] = useState('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const createClient = async () => {
    if (!newClientName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          description: newClientDescription,
        }),
      })
      const data = await res.json()

      if (res.ok && data.client) {
        setClients((prev) => [{ ...data.client, role: 'owner' }, ...prev])
        setShowCreateModal(false)
        setNewClientName('')
        setNewClientDescription('')
      } else {
        alert(data.error || 'Er ging iets mis bij het aanmaken van de klant')
      }
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Er ging iets mis bij het aanmaken van de klant')
    } finally {
      setCreating(false)
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      owner: { label: 'Eigenaar', variant: 'default' },
      admin: { label: 'Beheerder', variant: 'default' },
      editor: { label: 'Bewerker', variant: 'secondary' },
      viewer: { label: 'Kijker', variant: 'outline' },
    }
    const config = roleConfig[role] || { label: role, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Klanten</h1>
          <p className="text-surface-600 mt-1">
            Beheer je klanten en team toegang
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe Klant
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="w-full max-w-md">
        <Input
          placeholder="Zoek klanten..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-12 w-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              {searchQuery ? 'Geen klanten gevonden' : 'Nog geen klanten'}
            </h3>
            <p className="text-surface-600 mb-4">
              {searchQuery
                ? 'Probeer een andere zoekterm'
                : isAdmin
                ? 'Voeg je eerste klant toe om te beginnen'
                : 'Je hebt nog geen toegang tot klanten'}
            </p>
            {isAdmin && !searchQuery && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe Klant
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {client.logo_url ? (
                        <img
                          src={client.logo_url}
                          alt={client.name}
                          className="w-10 h-10 rounded-xl object-cover border border-surface-200"
                        />
                      ) : (
                        <ClientLogoFallback name={client.name} size="sm" className="w-10 h-10 text-base" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {client.name}
                      </CardTitle>
                      {getRoleBadge(client.role)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-surface-600 line-clamp-2">
                  {client.description || 'Geen beschrijving'}
                </p>

                <div className="flex gap-2">
                  <Link href={`/clients/${client.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Openen
                    </Button>
                  </Link>
                  {['owner', 'admin'].includes(client.role) && (
                    <Link href={`/clients/${client.id}?tab=team`}>
                      <Button variant="ghost" size="sm" title="Team beheren">
                        <Users className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-surface-900 mb-4">
              Nieuwe Klant
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Naam *
                </label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Bijv. Acme B.V."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Beschrijving
                </label>
                <Input
                  value={newClientDescription}
                  onChange={(e) => setNewClientDescription(e.target.value)}
                  placeholder="Korte beschrijving van de klant"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreateModal(false)}
              >
                Annuleren
              </Button>
              <Button
                className="flex-1"
                onClick={createClient}
                disabled={!newClientName.trim() || creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Aanmaken
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
