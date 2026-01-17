'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Key,
  Mail,
  Hash,
  FileJson,
  TestTube,
  Save,
  ExternalLink,
  Info,
  Users,
} from 'lucide-react'

interface ConnectionStatus {
  connected: boolean
  customerName?: string
  customerId?: string
  error?: string
}

interface AccessibleAccount {
  id: string
  name: string
  isManager: boolean
  status: string
  currency: string
  timezone: string
}

export default function GoogleAdsSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [accessibleAccounts, setAccessibleAccounts] = useState<AccessibleAccount[] | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // Form state
  const [developerToken, setDeveloperToken] = useState('')
  const [serviceAccountEmail, setServiceAccountEmail] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [loginCustomerId, setLoginCustomerId] = useState('')

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      try {
        const res = await fetch('/api/settings/google-ads')
        if (res.ok) {
          const data = await res.json()
          if (data.developerToken) setDeveloperToken(data.developerToken)
          if (data.serviceAccountEmail) setServiceAccountEmail(data.serviceAccountEmail)
          if (data.customerId) setCustomerId(data.customerId)
          if (data.loginCustomerId) setLoginCustomerId(data.loginCustomerId)
          // Don't load private key for security
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Handle JSON file upload
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (json.client_email) {
          setServiceAccountEmail(json.client_email)
        }
        if (json.private_key) {
          setPrivateKey(json.private_key)
        }
      } catch (err) {
        console.error('Invalid JSON file:', err)
        alert('Ongeldig JSON bestand. Zorg dat je het service account key bestand uploadt.')
      }
    }
    reader.readAsText(file)
  }

  // Test connection
  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    // Use customerId if provided, otherwise use loginCustomerId (MCC) for testing
    const testCustomerId = customerId?.trim()
      ? customerId.replace(/-/g, '')
      : loginCustomerId.replace(/-/g, '')

    try {
      const res = await fetch('/api/settings/google-ads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerToken,
          serviceAccountEmail,
          privateKey,
          customerId: testCustomerId,
          loginCustomerId: loginCustomerId?.replace(/-/g, '') || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setTestResult({
          connected: true,
          customerName: data.customerName,
          customerId: data.customerId,
        })
      } else {
        setTestResult({
          connected: false,
          error: data.error || 'Verbinding mislukt',
        })
      }
    } catch (err) {
      setTestResult({
        connected: false,
        error: (err as Error).message,
      })
    } finally {
      setTesting(false)
    }
  }

  // Save settings
  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch('/api/settings/google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerToken,
          serviceAccountEmail,
          privateKey,
          // For MCC setup: loginCustomerId is required, customerId is optional
          customerId: customerId?.trim() ? customerId.replace(/-/g, '') : null,
          loginCustomerId: loginCustomerId.replace(/-/g, ''),
        }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await res.json()
        alert(data.error || 'Opslaan mislukt')
      }
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // List accessible accounts
  const handleListAccounts = async () => {
    setLoadingAccounts(true)
    setAccessibleAccounts(null)
    setAccountsError(null)

    try {
      const res = await fetch('/api/settings/google-ads/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerToken,
          serviceAccountEmail,
          privateKey,
          loginCustomerId: loginCustomerId.replace(/-/g, ''),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setAccessibleAccounts(data.accounts)
      } else {
        setAccountsError(data.error || 'Kon accounts niet ophalen')
      }
    } catch (err) {
      setAccountsError((err as Error).message)
    } finally {
      setLoadingAccounts(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Google Ads Instellingen</h1>
        <p className="text-surface-600 mt-1">
          Configureer de Google Ads API verbinding voor monitoring
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Setup voor MCC (Agency)</p>
              <ol className="list-decimal list-inside space-y-2 text-blue-700">
                <li>
                  <strong>Developer Token</strong> - Aanvragen via{' '}
                  <a
                    href="https://ads.google.com/aw/apicenter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900"
                  >
                    Google Ads API Center
                    <ExternalLink className="inline h-3 w-3 ml-1" />
                  </a>
                </li>
                <li>
                  <strong>Service Account aanmaken</strong> in{' '}
                  <a
                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-900"
                  >
                    Google Cloud Console
                    <ExternalLink className="inline h-3 w-3 ml-1" />
                  </a>
                  {' '}en download de JSON key
                </li>
                <li>
                  <strong className="text-blue-900">BELANGRIJK:</strong> Voeg het service account email toe in Google Ads:
                  <ul className="list-disc list-inside ml-4 mt-1 text-blue-600">
                    <li>Ga naar je MCC account in Google Ads</li>
                    <li>Tools & Settings → Access and security</li>
                    <li>Klik + om gebruiker toe te voegen</li>
                    <li>Vul het service account email in (bijv. naam@project.iam.gserviceaccount.com)</li>
                    <li>Geef <strong>Read-only</strong> of <strong>Standard</strong> toegang</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Credentials
          </CardTitle>
          <CardDescription>
            Vul de Google Ads API gegevens in om monitoring te activeren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Developer Token */}
          <div className="space-y-2">
            <Label htmlFor="developerToken" className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-surface-500" />
              Developer Token
            </Label>
            <Input
              id="developerToken"
              type="password"
              placeholder="Jouw Google Ads developer token"
              value={developerToken}
              onChange={(e) => setDeveloperToken(e.target.value)}
            />
            <p className="text-xs text-surface-500">
              Te vinden in Google Ads → Tools & Settings → API Center
            </p>
          </div>

          {/* Service Account JSON Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-surface-500" />
              Service Account Key (JSON)
            </Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-surface-500">
              Upload het JSON key bestand van je service account
            </p>
          </div>

          {/* Service Account Email */}
          <div className="space-y-2">
            <Label htmlFor="serviceAccountEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-surface-500" />
              Service Account Email
            </Label>
            <Input
              id="serviceAccountEmail"
              type="email"
              placeholder="naam@project-id.iam.gserviceaccount.com"
              value={serviceAccountEmail}
              onChange={(e) => setServiceAccountEmail(e.target.value)}
            />
          </div>

          {/* Private Key */}
          <div className="space-y-2">
            <Label htmlFor="privateKey" className="flex items-center gap-2">
              <Key className="h-4 w-4 text-surface-500" />
              Private Key
            </Label>
            <Textarea
              id="privateKey"
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-xs text-surface-500">
              Wordt automatisch ingevuld bij JSON upload
            </p>
          </div>

          {/* MCC / Manager Account ID */}
          <div className="space-y-2">
            <Label htmlFor="loginCustomerId" className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-surface-500" />
              MCC Account ID (Manager Account)
            </Label>
            <Input
              id="loginCustomerId"
              placeholder="123-456-7890"
              value={loginCustomerId}
              onChange={(e) => setLoginCustomerId(e.target.value)}
            />
            <p className="text-xs text-surface-500">
              Je MCC (Manager Account) ID - dit geeft toegang tot alle gekoppelde klantaccounts
            </p>
          </div>

          {/* Customer ID (optional for testing) */}
          <div className="space-y-2">
            <Label htmlFor="customerId" className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-surface-500" />
              Test Customer ID (optioneel)
            </Label>
            <Input
              id="customerId"
              placeholder="123-456-7890"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
            <p className="text-xs text-surface-500">
              Optioneel: een klantaccount ID om de verbinding te testen. Laat leeg om het MCC account te gebruiken.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-lg ${
                testResult.connected
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.connected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                )}
                <div>
                  {testResult.connected ? (
                    <>
                      <p className="font-medium text-emerald-900">Verbinding geslaagd!</p>
                      <p className="text-sm text-emerald-700">
                        Account: {testResult.customerName} ({testResult.customerId})
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-red-900">Verbinding mislukt</p>
                      <p className="text-sm text-red-700">{testResult.error}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !developerToken || !serviceAccountEmail || !privateKey || !loginCustomerId}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Verbinding
            </Button>
            <Button
              variant="outline"
              onClick={handleListAccounts}
              disabled={loadingAccounts || !developerToken || !serviceAccountEmail || !privateKey || !loginCustomerId}
            >
              {loadingAccounts ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Bekijk Accounts
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !developerToken || !serviceAccountEmail || !privateKey || !loginCustomerId}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? 'Opgeslagen!' : 'Opslaan'}
            </Button>
          </div>

          {/* Accounts Error */}
          {accountsError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Kon accounts niet ophalen</p>
                  <p className="text-sm text-red-700">{accountsError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Accessible Accounts List */}
          {accessibleAccounts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-surface-900">
                  Toegankelijke Accounts ({accessibleAccounts.length})
                </h3>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Verbinding OK
                </Badge>
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {accessibleAccounts.map((account) => (
                  <div key={account.id} className="p-3 flex items-center justify-between hover:bg-surface-50">
                    <div>
                      <p className="font-medium text-surface-900">
                        {account.name || 'Naamloos account'}
                        {account.isManager && (
                          <Badge variant="secondary" className="ml-2 text-xs">MCC</Badge>
                        )}
                      </p>
                      <p className="text-sm text-surface-500">
                        ID: {account.id} • {account.currency} • {account.timezone}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomerId(account.id)}
                    >
                      Selecteer
                    </Button>
                  </div>
                ))}
                {accessibleAccounts.length === 0 && (
                  <div className="p-4 text-center text-surface-500">
                    Geen klantaccounts gevonden onder dit MCC account.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
