'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { Loader2, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  userId: string
  userName: string
  currentAvatarUrl?: string | null
  onAvatarChange: (url: string | null) => void
  size?: 'md' | 'lg' | 'xl'
  disabled?: boolean
}

export function AvatarUpload({
  userId,
  userName,
  currentAvatarUrl,
  onAvatarChange,
  size = 'xl',
  disabled = false
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Alleen JPG, PNG of WebP bestanden zijn toegestaan')
      return
    }

    // Validate file size (2MB max for avatars)
    if (file.size > 2 * 1024 * 1024) {
      setError('Bestand mag maximaal 2MB zijn')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `avatars/${userId}/${fileName}`

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = extractPathFromUrl(currentAvatarUrl)
        if (oldPath) {
          await supabase.storage.from('logos').remove([oldPath])
        }
      }

      // Upload new avatar
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

      onAvatarChange(publicUrl)
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

  // Extract file path from Supabase storage URL
  function extractPathFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/logos\/(.+)$/)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  const sizeClasses = {
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }

  const iconSizes = {
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />

        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || uploading}
          className={cn(
            'relative rounded-full overflow-hidden transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            !disabled && !uploading && 'cursor-pointer hover:opacity-90',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Avatar
            name={userName}
            src={currentAvatarUrl}
            size={size}
          />

          {/* Hover overlay */}
          {!disabled && !uploading && (
            <div className={cn(
              'absolute inset-0 bg-black/50 flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity rounded-full'
            )}>
              <Camera className={cn('text-white', iconSizes[size])} />
            </div>
          )}

          {/* Loading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
              <Loader2 className={cn('text-white animate-spin', iconSizes[size])} />
            </div>
          )}
        </button>
      </div>

      {!disabled && (
        <p className="text-xs text-surface-500 text-center">
          Klik om te wijzigen
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
