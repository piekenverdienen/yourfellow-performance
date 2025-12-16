'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoUploadProps {
  clientId: string
  clientName: string
  currentLogoUrl?: string | null
  onLogoChange: (url: string | null) => void
  disabled?: boolean
}

// Generate a consistent gradient based on string
function getGradientForName(name: string): string {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-green-500 to-emerald-500',
    'from-red-500 to-orange-500',
    'from-cyan-500 to-blue-500',
    'from-fuchsia-500 to-pink-500',
  ]

  // Simple hash based on name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return gradients[Math.abs(hash) % gradients.length]
}

// Get initials from name (max 2 characters)
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function ClientLogoFallback({
  name,
  size = 'md',
  className
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const gradient = getGradientForName(name)
  const initials = getInitials(name)

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  }

  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-inner',
        gradient,
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  )
}

export function LogoUpload({
  clientId,
  clientName,
  currentLogoUrl,
  onLogoChange,
  disabled = false
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Alleen JPG, PNG, SVG of WebP bestanden zijn toegestaan')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Bestand mag maximaal 5MB zijn')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `clients/${clientId}/${fileName}`

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = extractPathFromUrl(currentLogoUrl)
        if (oldPath) {
          await supabase.storage.from('logos').remove([oldPath])
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      onLogoChange(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Er ging iets mis bij het uploaden')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (!currentLogoUrl) return
    if (!confirm('Weet je zeker dat je het logo wilt verwijderen?')) return

    setDeleting(true)
    setError(null)

    try {
      const filePath = extractPathFromUrl(currentLogoUrl)
      if (filePath) {
        const { error: deleteError } = await supabase.storage
          .from('logos')
          .remove([filePath])

        if (deleteError) throw deleteError
      }

      onLogoChange(null)
    } catch (err) {
      console.error('Delete error:', err)
      setError('Er ging iets mis bij het verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  // Extract file path from Supabase storage URL
  function extractPathFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/logos\/(.+)$/)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-6">
        {/* Logo Preview */}
        <div className="flex-shrink-0">
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt={`${clientName} logo`}
              className="w-24 h-24 rounded-xl object-cover border border-surface-200 shadow-sm"
            />
          ) : (
            <ClientLogoFallback name={clientName} size="xl" />
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="font-medium text-surface-900">Klant Logo</h4>
            <p className="text-sm text-surface-500">
              Upload een logo voor {clientName}. JPG, PNG, SVG of WebP (max 5MB).
            </p>
          </div>

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || uploading}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {currentLogoUrl ? 'Vervangen' : 'Uploaden'}
            </Button>

            {currentLogoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={disabled || deleting}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Verwijderen
              </Button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {!currentLogoUrl && (
            <p className="text-xs text-surface-400 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Zonder logo wordt een gradient met initialen getoond
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
