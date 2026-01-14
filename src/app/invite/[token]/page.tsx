'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  Loader2,
  ArrowRight,
  LogIn,
  Mail,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'

interface InviteDetails {
  valid: boolean
  status: string
  email: string
  client_name: string
  role: string
  invited_by: string | null
  message: string | null
  expires_at: string
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [token, setToken] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ client_name: string; client_id: string } | null>(null)

  // Get token from params
  useEffect(() => {
    params.then(p => setToken(p.token))
  }, [params])

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      if (!token) return

      try {
        const response = await fetch(`/api/invites/${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Invite niet gevonden')
          return
        }

        setInvite(data)
      } catch (err) {
        setError('Fout bij laden van invite')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvite()
  }, [token])

  const handleAccept = async () => {
    if (!token) return

    setIsAccepting(true)
    setError(null)

    try {
      const response = await fetch(`/api/invites/${token}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.redirect_to_login) {
          router.push(`/login?redirect=/invite/${token}`)
          return
        }
        throw new Error(data.error || 'Fout bij accepteren')
      }

      setSuccess({
        client_name: data.client_name,
        client_id: data.client_id,
      })

      // Redirect to client page after 2 seconds
      setTimeout(() => {
        router.push(`/clients/${data.client_id}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij accepteren')
    } finally {
      setIsAccepting(false)
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

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="white" size="lg" />
        </div>

        {/* Success State */}
        {success && (
          <Card className="bg-surface-800 border-surface-700">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Welkom!</h2>
              <p className="text-surface-400">
                Je hebt nu toegang tot <span className="text-white font-medium">{success.client_name}</span>
              </p>
              <p className="text-sm text-surface-500 mt-4">
                Je wordt doorgestuurd naar het dashboard...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !success && (
          <Card className="bg-surface-800 border-surface-700">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Oeps!</h2>
              <p className="text-surface-400">{error}</p>
              <Link href="/dashboard">
                <Button variant="outline" className="mt-6">
                  Naar Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Invite Details */}
        {invite && !error && !success && (
          <Card className="bg-surface-800 border-surface-700">
            <CardContent className="p-8">
              {/* Invalid/Expired State */}
              {!invite.valid && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {invite.status === 'expired' && 'Invite verlopen'}
                    {invite.status === 'accepted' && 'Invite al geaccepteerd'}
                    {invite.status === 'revoked' && 'Invite ingetrokken'}
                  </h2>
                  <p className="text-surface-400">
                    {invite.status === 'expired' && 'Deze uitnodiging is niet meer geldig.'}
                    {invite.status === 'accepted' && 'Deze uitnodiging is al geaccepteerd.'}
                    {invite.status === 'revoked' && 'Deze uitnodiging is ingetrokken door de afzender.'}
                  </p>
                  <Link href="/login">
                    <Button variant="outline" className="mt-6">
                      Naar Login
                    </Button>
                  </Link>
                </div>
              )}

              {/* Valid Invite */}
              {invite.valid && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">Je bent uitgenodigd!</h2>
                    <p className="text-surface-400">
                      {invite.invited_by ? `${invite.invited_by} heeft` : 'Je bent'} je uitgenodigd om deel te nemen.
                    </p>
                  </div>

                  {/* Client Info */}
                  <div className="bg-surface-900 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-surface-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{invite.client_name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-surface-500">Rol:</span>
                          {getRoleBadge(invite.role)}
                        </div>
                      </div>
                    </div>

                    {invite.message && (
                      <div className="mt-3 pt-3 border-t border-surface-700">
                        <p className="text-sm text-surface-400 italic">"{invite.message}"</p>
                      </div>
                    )}
                  </div>

                  {/* Invite Info */}
                  <div className="flex items-center gap-2 text-sm text-surface-500 mb-6">
                    <Mail className="h-4 w-4" />
                    <span>Uitgenodigd voor: {invite.email}</span>
                  </div>

                  {/* Action */}
                  {user ? (
                    <Button
                      onClick={handleAccept}
                      isLoading={isAccepting}
                      className="w-full"
                      size="lg"
                      rightIcon={!isAccepting && <ArrowRight className="h-4 w-4" />}
                    >
                      {isAccepting ? 'Even geduld...' : 'Accepteren'}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-surface-400">
                        Log eerst in om de uitnodiging te accepteren
                      </p>
                      <Link href={`/login?redirect=/invite/${token}`}>
                        <Button className="w-full" size="lg" rightIcon={<LogIn className="h-4 w-4" />}>
                          Inloggen
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Expiry notice */}
                  <p className="text-center text-xs text-surface-500 mt-4">
                    Geldig tot {formatExpiryDate(invite.expires_at)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
