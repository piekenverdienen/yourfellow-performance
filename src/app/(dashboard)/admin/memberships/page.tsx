'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'
import {
  Shield,
  UserCheck,
  UserX,
  Clock,
  Building2,
  User,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Send,
  Copy,
  Check,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PendingMembership {
  id: string
  user_id: string
  client_id: string
  requested_role: string
  request_reason: string | null
  created_at: string
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  client: {
    id: string
    name: string
    slug: string
  }
  requester: {
    id: string
    email: string
    full_name: string | null
  } | null
}

interface Client {
  id: string
  name: string
  slug: string
}

export default function AdminMembershipsPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [pendingMemberships, setPendingMemberships] = useState<PendingMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Invite form state
  const [clients, setClients] = useState<Client[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteMessage, setInviteMessage] = useState('')
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [isInviting, setIsInviting] = useState(false)
  const [inviteResults, setInviteResults] = useState<{ email: string; results: { client: string; success: boolean; url?: string; error?: string }[] } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const isOrgAdmin = user?.role === 'admin'

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
  }, [])

  const fetchPendingMemberships = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/memberships')

      if (!response.ok) {
        if (response.status === 403) {
          setError('Je hebt geen toegang tot deze pagina')
          return
        }
        throw new Error('Fout bij ophalen van data')
      }

      const data = await response.json()
      setPendingMemberships(data.pending_memberships || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userLoading) {
      if (!isOrgAdmin) {
        router.push('/dashboard')
        return
      }
      fetchPendingMemberships()
      fetchClients()
    }
  }, [userLoading, isOrgAdmin, router, fetchPendingMemberships, fetchClients])

  const handleAction = async (membershipId: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(membershipId)
    setActionResult(null)

    try {
      const response = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_id: membershipId,
          action,
          reason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Actie mislukt')
      }

      setActionResult({
        id: membershipId,
        success: true,
        message: action === 'approve' ? 'Toegang goedgekeurd' : 'Toegang afgewezen',
      })

      setTimeout(() => {
        setPendingMemberships(prev => prev.filter(m => m.id !== membershipId))
        setActionResult(null)
      }, 1500)
    } catch (err) {
      setActionResult({
        id: membershipId,
        success: false,
        message: err instanceof Error ? err.message : 'Actie mislukt',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || selectedClients.length === 0) return

    setIsInviting(true)
    setInviteResults(null)

    const results: { client: string; success: boolean; url?: string; error?: string }[] = []

    for (const clientId of selectedClients) {
      const client = clients.find(c => c.id === clientId)
      try {
        const response = await fetch('/api/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteEmail,
            client_id: clientId,
            role: inviteRole,
            message: inviteMessage || undefined,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          results.push({
            client: client?.name || clientId,
            success: true,
            url: data.invite_url,
          })
        } else {
          results.push({
            client: client?.name || clientId,
            success: false,
            error: data.error,
          })
        }
      } catch (err) {
        results.push({
          client: client?.name || clientId,
          success: false,
          error: 'Netwerk fout',
        })
      }
    }

    setInviteResults({ email: inviteEmail, results })
    setIsInviting(false)
  }

  const resetInviteForm = () => {
    setInviteEmail('')
    setInviteRole('viewer')
    setInviteMessage('')
    setSelectedClients([])
    setInviteResults(null)
  }

  const toggleClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    )
  }

  const selectAllClients = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(clients.map(c => c.id))
    }
  }

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'error' }> = {
      owner: { label: 'Eigenaar', variant: 'error' },
      admin: { label: 'Beheerder', variant: 'default' },
      editor: { label: 'Bewerker', variant: 'secondary' },
      viewer: { label: 'Kijker', variant: 'outline' },
    }
    const config = roleConfig[role] || { label: role, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return 'Zojuist'
    if (diffHours < 24) return `${diffHours} uur geleden`
    if (diffDays === 1) return 'Gisteren'
    return `${diffDays} dagen geleden`
  }

  const roleOptions = [
    { value: 'viewer', label: 'Kijker - Alleen bekijken' },
    { value: 'editor', label: 'Bewerker - Kan content maken' },
    { value: 'admin', label: 'Beheerder - Volledige toegang' },
    { value: 'owner', label: 'Eigenaar - Volledige toegang + verwijderen' },
  ]

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isOrgAdmin) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Gebruikersbeheer</h1>
            <p className="text-surface-600">
              Nodig gebruikers uit en beheer toegangsverzoeken
            </p>
          </div>
        </div>
      </div>

      {/* Invite Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Gebruiker uitnodigen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inviteResults ? (
            // Show results
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-surface-900">
                <Mail className="h-5 w-5" />
                <span>Uitnodigingen voor <strong>{inviteResults.email}</strong></span>
              </div>

              <div className="space-y-2">
                {inviteResults.results.map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-3 rounded-lg flex items-center justify-between',
                      result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                        {result.client}
                      </span>
                      {result.error && (
                        <span className="text-sm text-red-600">- {result.error}</span>
                      )}
                    </div>
                    {result.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(result.url!)}
                      >
                        {copiedUrl === result.url ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={resetInviteForm}>
                  Nieuwe uitnodiging
                </Button>
                {inviteResults.results.some(r => r.success && r.url) && (
                  <Button
                    onClick={async () => {
                      const urls = inviteResults.results
                        .filter(r => r.success && r.url)
                        .map(r => `${r.client}: ${r.url}`)
                        .join('\n')
                      await navigator.clipboard.writeText(urls)
                      alert('Alle links gekopieerd!')
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Alle links kopiëren
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Show form
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Email adres *
                  </label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="nieuwe.collega@bedrijf.nl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Rol
                  </label>
                  <Select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    options={roleOptions}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">
                  Persoonlijk bericht (optioneel)
                </label>
                <Input
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Welkom bij het team!"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-surface-700">
                    Toegang tot klanten * ({selectedClients.length} geselecteerd)
                  </label>
                  <Button variant="ghost" size="sm" onClick={selectAllClients}>
                    {selectedClients.length === clients.length ? 'Deselecteer alle' : 'Selecteer alle'}
                  </Button>
                </div>
                <div className="border border-surface-200 rounded-lg max-h-48 overflow-y-auto">
                  {clients.length === 0 ? (
                    <p className="p-4 text-center text-surface-500">Geen klanten gevonden</p>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {clients.map((client) => (
                        <label
                          key={client.id}
                          className="flex items-center gap-3 p-3 hover:bg-surface-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.id)}
                            onChange={() => toggleClient(client.id)}
                            className="h-4 w-4 rounded border-surface-300 text-primary focus:ring-primary"
                          />
                          <Building2 className="h-4 w-4 text-surface-400" />
                          <span className="text-surface-900">{client.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || selectedClients.length === 0 || isInviting}
                >
                  {isInviting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Uitnodigen voor {selectedClients.length} klant{selectedClients.length !== 1 ? 'en' : ''}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Beveiligingscontrole</p>
              <p className="text-sm text-amber-700 mt-1">
                Gebruikers die via deze pagina worden uitgenodigd krijgen automatisch toegang.
                Controleer het emailadres voordat je uitnodigt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendingMemberships}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Opnieuw proberen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Memberships Section */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          Openstaande toegangsverzoeken
        </h2>
      </div>

      {pendingMemberships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-medium text-surface-900 mb-1">
              Geen openstaande verzoeken
            </h3>
            <p className="text-sm text-surface-600">
              Alle toegangsverzoeken zijn afgehandeld.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-surface-600">
              <span className="font-semibold text-surface-900">{pendingMemberships.length}</span> openstaande verzoeken
            </p>
            <Button variant="ghost" size="sm" onClick={fetchPendingMemberships}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Vernieuwen
            </Button>
          </div>

          {pendingMemberships.map((membership) => {
            const isProcessing = processingId === membership.id
            const result = actionResult?.id === membership.id ? actionResult : null

            return (
              <Card
                key={membership.id}
                className={cn(
                  'transition-all',
                  result?.success && 'border-green-200 bg-green-50',
                  result && !result.success && 'border-red-200 bg-red-50'
                )}
              >
                <CardContent className="p-5">
                  {result && (
                    <div
                      className={cn(
                        'flex items-center gap-2 mb-4 p-2 rounded-lg',
                        result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}
                    >
                      {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      <span className="text-sm font-medium">{result.message}</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center">
                          {membership.user.avatar_url ? (
                            <img
                              src={membership.user.avatar_url}
                              alt={membership.user.full_name || ''}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-surface-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900">
                            {membership.user.full_name || membership.user.email}
                          </p>
                          <p className="text-sm text-surface-500">{membership.user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-surface-400" />
                          <span className="text-surface-700">
                            Toegang tot <strong>{membership.client.name}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-surface-500">als</span>
                          {getRoleBadge(membership.requested_role)}
                        </div>
                      </div>

                      {membership.request_reason && (
                        <div className="mt-3 p-2 bg-surface-50 rounded-lg">
                          <p className="text-sm text-surface-600">
                            <span className="font-medium">Reden:</span> {membership.request_reason}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{getTimeAgo(membership.created_at)}</span>
                        </div>
                        {membership.requester && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>
                              Aangevraagd door {membership.requester.full_name || membership.requester.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleAction(membership.id, 'approve')}
                        disabled={isProcessing || !!result}
                        className="min-w-[120px]"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Goedkeuren
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAction(membership.id, 'reject')}
                        disabled={isProcessing || !!result}
                        className="min-w-[120px] text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserX className="h-4 w-4 mr-1" />
                            Afwijzen
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
