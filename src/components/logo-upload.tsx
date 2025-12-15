'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ClientLogo } from '@/components/client-logo'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoUploadProps {
  clientId: string
  clientName: string
  currentLogoUrl?: string | null
  onLogoChange?: (newUrl: string | null) => void
  className?: string
}

export function LogoUpload({
  clientId,
  clientName,
  currentLogoUrl,
  onLogoChange,
  className
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setLogoUrl(data.logo_url)
      onLogoChange?.(data.logo_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    setError(null)
    setRemoving(true)

    try {
      const res = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Remove failed')
      }

      setLogoUrl(null)
      onLogoChange?.(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-4">
        {/* Current Logo Preview */}
        <div className="relative">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-surface-300 flex items-center justify-center overflow-hidden bg-surface-50">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${clientName} logo`}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <ClientLogo name={clientName} size="lg" className="w-14 h-14" />
            )}
          </div>
          {logoUrl && !removing && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Verwijder logo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {removing && (
            <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <h4 className="font-medium text-surface-900 mb-1">Client Logo</h4>
          <p className="text-sm text-surface-500 mb-3">
            Upload een logo voor deze client. Ondersteunde formaten: JPG, PNG, SVG, WebP (max 5MB)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/svg+xml,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            id={`logo-upload-${clientId}`}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploaden...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {logoUrl ? 'Vervang Logo' : 'Upload Logo'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  )
}
