'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export default function AdminMembershipsPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [pendingMemberships, setPendingMemberships] = useState<PendingMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const isOrgAdmin = user?.role === 'admin'

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
    }
  }, [userLoading, isOrgAdmin, router, fetchPendingMemberships])

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

      // Remove from list after short delay
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
            <h1 className="text-2xl font-bold text-surface-900">Toegangsverzoeken</h1>
            <p className="text-surface-600">
              Beheer verzoeken voor toegang tot klantdata
            </p>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Beveiligingscontrole vereist</p>
              <p className="text-sm text-amber-700 mt-1">
                Nieuwe teamleden krijgen pas toegang tot klantdata na jouw goedkeuring.
                Controleer of de aanvrager daadwerkelijk toegang nodig heeft voordat je goedkeurt.
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

      {/* Pending Memberships List */}
      {pendingMemberships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">
              Geen openstaande verzoeken
            </h3>
            <p className="text-surface-600">
              Alle toegangsverzoeken zijn afgehandeld. Nieuwe verzoeken verschijnen hier.
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
                  {/* Result message */}
                  {result && (
                    <div
                      className={cn(
                        'flex items-center gap-2 mb-4 p-2 rounded-lg',
                        result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}
                    >
                      {result.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">{result.message}</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    {/* Left: User & Client Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        {/* User Avatar */}
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
                              Aangevraagd door{' '}
                              {membership.requester.full_name || membership.requester.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
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

      {/* Info Card */}
      <Card className="mt-8 bg-surface-50 border-surface-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-surface-900 mb-2">Over dit systeem</h4>
          <ul className="text-sm text-surface-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Nieuwe teamleden worden automatisch op &quot;pending&quot; gezet totdat een org admin goedkeurt.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Gebruikers met pending status hebben geen toegang tot klantdata.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Als jij (org admin) iemand toevoegt, wordt deze automatisch goedgekeurd.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Alle acties worden gelogd in de audit trail.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
