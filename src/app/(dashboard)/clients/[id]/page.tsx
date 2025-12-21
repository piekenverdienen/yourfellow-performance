'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Select } from '@/components/ui/select'
import {
  ArrowLeft,
  Building2,
  Users,
  Settings,
  Loader2,
  UserPlus,
  Trash2,
  Save,
  Crown,
  Shield,
  Edit3,
  Eye,
  Brain,
  CheckSquare,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { useClientStore } from '@/stores/client-store'
import { ClientContextForm } from '@/components/client-context-form'
import { LogoUpload, ClientLogoFallback } from '@/components/logo-upload'
import { ClickUpTasks } from '@/components/clickup-tasks'
import { ClickUpSetup } from '@/components/clickup-setup'
import { GA4MonitoringSetup } from '@/components/ga4-monitoring-setup'
import { SearchConsoleSetup } from '@/components/search-console-setup'
import { MetaAdsSetup } from '@/components/meta-ads-setup'
import type { Client, ClientMemberRole, ClientContext, User, GA4MonitoringSettings, SearchConsoleSettings, MetaAdsSettings } from '@/types'

interface ClientMember {
  id: string
  user_id: string
  role: ClientMemberRole
  created_at: string
  updated_at: string
  user: User
}

interface ClientWithRole extends Client {
  role: ClientMemberRole | 'admin'
}

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: currentUser } = useUser()
  const { fetchClients } = useClientStore()

  const [client, setClient] = useState<ClientWithRole | null>(null)
  const [members, setMembers] = useState<ClientMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'context' | 'team' | 'settings'>(
    (searchParams.get('tab') as 'overview' | 'tasks' | 'context' | 'team' | 'settings') || 'overview'
  )

  // Edit state
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<ClientMemberRole>('viewer')
  const [addingMember, setAddingMember] = useState(false)

  // Delete client state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const isAdmin = client && ['owner', 'admin'].includes(client.role)
  const isOwner = client?.role === 'owner'

  useEffect(() => {
    fetchClientData()
    fetchMembers()
  }, [id])

  useEffect(() => {
    if (client) {
      setEditedName(client.name)
      setEditedDescription(client.description || '')
    }
  }, [client])

  const fetchClientData = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`)
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          router.push('/clients')
          return
        }
        throw new Error(data.error)
      }

      setClient(data.client)
    } catch (error) {
      console.error('Error fetching client:', error)
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/clients/${id}/memberships`)
      const data = await res.json()

      if (res.ok) {
        setMembers(data.memberships || [])
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const saveClientSettings = async () => {
    if (!editedName.trim()) return

    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setClient(data.client)
        fetchClients() // Refresh global client list
        alert('Klant instellingen opgeslagen')
      } else {
        alert(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error saving client:', error)
      alert('Er ging iets mis')
    } finally {
      setSaving(false)
    }
  }

  const addMember = async () => {
    if (!newMemberEmail.trim()) return

    setAddingMember(true)
    try {
      const res = await fetch(`/api/clients/${id}/memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail,
          role: newMemberRole,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setMembers((prev) => [data.membership, ...prev])
        setShowAddMember(false)
        setNewMemberEmail('')
        setNewMemberRole('viewer')
      } else {
        alert(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Er ging iets mis')
    } finally {
      setAddingMember(false)
    }
  }

  const updateMemberRole = async (userId: string, newRole: ClientMemberRole) => {
    try {
      const res = await fetch(`/api/clients/${id}/memberships/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? data.membership : m))
        )
      } else {
        alert(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error updating member:', error)
      alert('Er ging iets mis')
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Weet je zeker dat je dit teamlid wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/clients/${id}/memberships/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      } else {
        const data = await res.json()
        alert(data.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Er ging iets mis')
    }
  }

  const deleteClient = async () => {
    if (deleteConfirmName !== client?.name) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchClients() // Refresh global client list
        router.push('/clients')
      } else {
        const data = await res.json()
        alert(data.error || 'Er ging iets mis bij het verwijderen')
      }
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Er ging iets mis bij het verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-primary" />
      case 'editor':
        return <Edit3 className="h-4 w-4 text-surface-500" />
      default:
        return <Eye className="h-4 w-4 text-surface-400" />
    }
  }

  const roleOptions = [
    { value: 'viewer', label: 'Kijker - Alleen bekijken' },
    { value: 'editor', label: 'Bewerker - Kan content maken' },
    { value: 'admin', label: 'Beheerder - Volledige toegang' },
    { value: 'owner', label: 'Eigenaar - Volledige toegang + verwijderen' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!client) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.name}
              className="w-12 h-12 rounded-xl object-cover border border-surface-200"
            />
          ) : (
            <ClientLogoFallback name={client.name} size="md" />
          )}
          <div>
            <h1 className="text-xl font-bold text-surface-900">{client.name}</h1>
            <Badge variant={['owner', 'admin'].includes(client.role) ? 'default' : 'secondary'}>
              {client.role === 'owner'
                ? 'Eigenaar'
                : client.role === 'admin'
                ? 'Beheerder'
                : client.role === 'editor'
                ? 'Bewerker'
                : 'Kijker'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          }`}
        >
          <Building2 className="h-4 w-4 inline-block mr-2" />
          Overzicht
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          }`}
        >
          <CheckSquare className="h-4 w-4 inline-block mr-2" />
          Taken
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'context'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          }`}
        >
          <Brain className="h-4 w-4 inline-block mr-2" />
          AI Context
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'team'
              ? 'border-primary text-primary'
              : 'border-transparent text-surface-600 hover:text-surface-900'
          }`}
        >
          <Users className="h-4 w-4 inline-block mr-2" />
          Team ({members.length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-surface-600 hover:text-surface-900'
            }`}
          >
            <Settings className="h-4 w-4 inline-block mr-2" />
            Instellingen
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Klant Informatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-surface-500">Naam</label>
              <p className="text-surface-900">{client.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-500">Beschrijving</label>
              <p className="text-surface-900">
                {client.description || 'Geen beschrijving'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-500">
                Aangemaakt op
              </label>
              <p className="text-surface-900">
                {new Date(client.created_at).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <ClickUpTasks
          clientId={id}
          listId={client.settings?.clickup?.listId}
          canEdit={isAdmin || client.role === 'editor'}
        />
      )}

      {activeTab === 'context' && (
        <ClientContextForm
          clientId={id}
          initialContext={client.settings?.context}
          canEdit={isAdmin || false}
          onSave={(context) => {
            setClient((prev) =>
              prev
                ? {
                    ...prev,
                    settings: { ...prev.settings, context },
                  }
                : prev
            )
          }}
        />
      )}

      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* Add Member Button */}
          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => setShowAddMember(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Teamlid toevoegen
              </Button>
            </div>
          )}

          {/* Members List */}
          <Card>
            <CardHeader>
              <CardTitle>Teamleden</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-center text-surface-500 py-8">
                  Nog geen teamleden toegevoegd
                </p>
              ) : (
                <div className="divide-y divide-surface-100">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={member.user?.full_name || 'User'}
                          src={member.user?.avatar_url}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-surface-900">
                            {member.user?.full_name || 'Onbekende gebruiker'}
                            {member.user_id === currentUser?.id && (
                              <span className="text-xs text-surface-500 ml-2">
                                (jij)
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-surface-500">
                            {member.user?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        {isAdmin && member.user_id !== currentUser?.id ? (
                          <Select
                            value={member.role}
                            onChange={(e) =>
                              updateMemberRole(
                                member.user_id,
                                e.target.value as ClientMemberRole
                              )
                            }
                            options={roleOptions}
                            className="w-48"
                          />
                        ) : (
                          <span className="text-sm text-surface-600 capitalize">
                            {member.role === 'owner'
                              ? 'Eigenaar'
                              : member.role === 'admin'
                              ? 'Beheerder'
                              : member.role === 'editor'
                              ? 'Bewerker'
                              : 'Kijker'}
                          </span>
                        )}
                        {isAdmin && member.user_id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeMember(member.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setShowAddMember(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
                <h2 className="text-xl font-bold text-surface-900 mb-4">
                  Teamlid toevoegen
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      Email adres *
                    </label>
                    <Input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="teamlid@bedrijf.nl"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      Rol
                    </label>
                    <Select
                      value={newMemberRole}
                      onChange={(e) =>
                        setNewMemberRole(e.target.value as ClientMemberRole)
                      }
                      options={roleOptions.filter(
                        (o) => o.value !== 'owner' || currentUser?.role === 'admin'
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddMember(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={addMember}
                    disabled={!newMemberEmail.trim() || addingMember}
                  >
                    {addingMember ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Toevoegen
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keep settings tab mounted to preserve form state when switching tabs */}
      {isAdmin && (
        <div className={`space-y-6 ${activeTab !== 'settings' ? 'hidden' : ''}`}>
          {/* ClickUp Integration */}
          <Card>
            <CardHeader>
              <CardTitle>ClickUp Koppeling</CardTitle>
            </CardHeader>
            <CardContent>
              <ClickUpSetup
                clientId={id}
                currentListId={client.settings?.clickup?.listId}
                onSave={async (listId) => {
                  const newSettings = {
                    ...client.settings,
                    clickup: listId ? { listId } : undefined,
                  }
                  const res = await fetch(`/api/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: newSettings }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setClient(data.client)
                    fetchClients() // Refresh global client list to sync settings
                  } else {
                    const error = await res.json()
                    throw new Error(error.error || 'Fout bij opslaan')
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* GA4 Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle>GA4 Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <GA4MonitoringSetup
                clientId={id}
                currentSettings={client.settings?.ga4Monitoring}
                onSave={async (ga4Settings) => {
                  const newSettings = {
                    ...client.settings,
                    ga4Monitoring: ga4Settings,
                  }
                  const res = await fetch(`/api/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: newSettings }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setClient(data.client)
                    fetchClients() // Refresh global client list to sync settings
                  } else {
                    const error = await res.json()
                    throw new Error(error.error || 'Fout bij opslaan')
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* Search Console */}
          <Card>
            <CardHeader>
              <CardTitle>Search Console</CardTitle>
            </CardHeader>
            <CardContent>
              <SearchConsoleSetup
                clientId={id}
                currentSettings={client.settings?.searchConsole}
                onSave={async (scSettings) => {
                  const newSettings = {
                    ...client.settings,
                    searchConsole: scSettings,
                  }
                  const res = await fetch(`/api/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: newSettings }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setClient(data.client)
                    fetchClients() // Refresh global client list to sync settings
                  } else {
                    const error = await res.json()
                    throw new Error(error.error || 'Fout bij opslaan')
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* Meta Ads */}
          <Card>
            <CardHeader>
              <CardTitle>Meta Ads (Facebook & Instagram)</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaAdsSetup
                clientId={id}
                currentSettings={client.settings?.meta}
                onSave={async (metaSettings) => {
                  const newSettings = {
                    ...client.settings,
                    meta: metaSettings,
                  }
                  const res = await fetch(`/api/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: newSettings }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setClient(data.client)
                    fetchClients() // Refresh global client list to sync settings
                  } else {
                    const error = await res.json()
                    throw new Error(error.error || 'Fout bij opslaan')
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoUpload
                clientId={id}
                clientName={client.name}
                currentLogoUrl={client.logo_url}
                onLogoChange={async (url) => {
                  // Update client logo in database
                  try {
                    const res = await fetch(`/api/clients/${id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logo_url: url }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      setClient(data.client)
                      fetchClients() // Refresh global client list
                    }
                  } catch (error) {
                    console.error('Error updating logo:', error)
                  }
                }}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Algemene Instellingen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Naam *
                </label>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Klant naam"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Beschrijving
                </label>
                <Input
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Korte beschrijving"
                />
              </div>

              <div className="pt-4 border-t border-surface-100">
                <Button
                  onClick={saveClientSettings}
                  disabled={!editedName.trim() || saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Opslaan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Gevaarzone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-surface-900 mb-1">
                  Klant verwijderen
                </h4>
                <p className="text-sm text-surface-500 mb-4">
                  Als je deze klant verwijdert, worden alle gegevens permanent verwijderd.
                  Dit kan niet ongedaan worden gemaakt.
                </p>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Klant verwijderen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Client Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setShowDeleteModal(false)
              setDeleteConfirmName('')
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-red-600 mb-2">
              Klant verwijderen
            </h2>
            <p className="text-surface-600 mb-4">
              Weet je zeker dat je <strong>{client.name}</strong> wilt verwijderen?
              Alle gegevens worden permanent verwijderd.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Typ <strong>{client.name}</strong> om te bevestigen
              </label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={client.name}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmName('')
                }}
              >
                Annuleren
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={deleteClient}
                disabled={deleteConfirmName !== client.name || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Verwijderen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
