'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'
import { Building2 } from 'lucide-react'

interface ClientLogoProps {
  name: string
  logoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Client logo component with fallback to initials or icon
 *
 * Usage:
 * - Upload client logos to /public/logos/clients/[client-slug].png
 * - Or set logo_url in the database to an external URL
 * - Falls back to company initials if no logo available
 */
export function ClientLogo({ name, logoUrl, size = 'md', className }: ClientLogoProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  // Get initials from company name (max 2 characters)
  const getInitials = (companyName: string) => {
    const words = companyName.trim().split(/\s+/)
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    return companyName.slice(0, 2).toUpperCase()
  }

  // If there's a logo URL, show the image
  if (logoUrl) {
    return (
      <div className={cn(
        'relative rounded-lg overflow-hidden bg-surface-100 flex items-center justify-center',
        sizes[size],
        className
      )}>
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          fill
          className="object-contain p-1"
          onError={(e) => {
            // Hide broken image and show fallback
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
    )
  }

  // Fallback: show initials with gradient background
  const initials = getInitials(name)

  // Generate consistent color based on company name
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-orange-500 to-orange-600',
    'from-teal-500 to-teal-600',
    'from-indigo-500 to-indigo-600',
    'from-rose-500 to-rose-600',
    'from-emerald-500 to-emerald-600',
  ]
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  const gradientColor = colors[colorIndex]

  return (
    <div className={cn(
      'rounded-lg flex items-center justify-center font-semibold text-white bg-gradient-to-br',
      sizes[size],
      gradientColor,
      className
    )}>
      {initials}
    </div>
  )
}

/**
 * Placeholder for when no client is selected
 */
export function ClientLogoPlaceholder({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  return (
    <div className={cn(
      'rounded-lg bg-surface-100 flex items-center justify-center',
      sizes[size],
      className
    )}>
      <Building2 className={cn('text-surface-400', iconSizes[size])} />
    </div>
  )
}
