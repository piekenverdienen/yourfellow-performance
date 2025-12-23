'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Unlink,
} from 'lucide-react'
import type { GoogleAdsSettings } from '@/types'

interface GoogleAdsSetupProps {
  clientId: string
  currentSettings?: GoogleAdsSettings
  onRefresh?: () => void
  disabled?: boolean
}

export function GoogleAdsSetup({
  clientId,
  currentSettings,
  onRefresh,
  disabled = false,
}: GoogleAdsSetupProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const status = currentSettings?.status || 'not_connected'

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch(`/api/google-ads/oauth?client_id=${clientId}`)
      const data = await response.json()

      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        alert('Kon OAuth URL niet ophalen')
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error)
      alert('Er ging iets mis bij het starten van de koppeling')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je Google Ads wilt ontkoppelen? Monitoring wordt uitgeschakeld.')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/google-ads/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (response.ok) {
        onRefresh?.()
      } else {
        alert('Kon Google Ads niet ontkoppelen')
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      alert('Er ging iets mis bij het ontkoppelen')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {status === 'connected' && (
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            )}
            {status === 'pending' && (
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            )}
            {status === 'not_connected' && (
              <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-surface-400" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-surface-900">
              {status === 'connected' && 'Google Ads Gekoppeld'}
              {status === 'pending' && 'Koppeling in behandeling'}
              {status === 'not_connected' && 'Google Ads niet gekoppeld'}
            </p>
            <p className="text-sm text-surface-500">
              {status === 'connected' && currentSettings?.customerId && (
                <>Account ID: {currentSettings.customerId}</>
              )}
              {status === 'connected' && currentSettings?.customerName && (
                <> - {currentSettings.customerName}</>
              )}
              {status === 'pending' && 'Wacht op verificatie...'}
              {status === 'not_connected' && 'Koppel om monitoring te activeren'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://ads.google.com', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Google Ads
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting || disabled}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting || disabled}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {status === 'pending' ? 'Opnieuw koppelen' : 'Koppel Google Ads'}
            </Button>
          )}
        </div>
      </div>

      {/* Monitoring Status */}
      {status === 'connected' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Monitoring Actief</p>
              <p className="text-sm text-green-700 mt-1">
                Google Ads wordt automatisch gecontroleerd op problemen zoals
                afgekeurde advertenties en campagnes zonder impressies.
              </p>
              {currentSettings?.lastCheckAt && (
                <p className="text-xs text-green-600 mt-2">
                  Laatste check: {new Date(currentSettings.lastCheckAt).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info for not connected */}
      {status === 'not_connected' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Waarom koppelen?</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Automatische detectie van afgekeurde advertenties</li>
                <li>• Alerts bij campagnes zonder impressies</li>
                <li>• Kritieke issues direct op je dashboard</li>
                <li>• Read-only toegang, we veranderen niets</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
