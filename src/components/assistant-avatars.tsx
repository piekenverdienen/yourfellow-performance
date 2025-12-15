'use client'

import { cn } from '@/lib/utils'

interface AvatarProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
}

// Max - Friendly marketing assistant with headset
export function MaxAvatar({ className, size = 'md' }: AvatarProps) {
  return (
    <div className={cn(sizes[size], 'rounded-full overflow-hidden', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="maxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFCC" />
            <stop offset="100%" stopColor="#00D4AA" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#maxGradient)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#FCD5B8" />

        {/* Hair */}
        <ellipse cx="50" cy="32" rx="24" ry="14" fill="#4A3728" />
        <ellipse cx="50" cy="28" rx="20" ry="10" fill="#5C4333" />

        {/* Eyes */}
        <ellipse cx="40" cy="50" rx="4" ry="5" fill="#2D3748" />
        <ellipse cx="60" cy="50" rx="4" ry="5" fill="#2D3748" />
        <circle cx="41" cy="49" r="1.5" fill="white" />
        <circle cx="61" cy="49" r="1.5" fill="white" />

        {/* Friendly smile */}
        <path d="M 40 62 Q 50 70 60 62" stroke="#2D3748" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Headset */}
        <path d="M 22 48 Q 22 28 50 28 Q 78 28 78 48" stroke="#1A1A2E" strokeWidth="4" fill="none" />
        <circle cx="22" cy="52" r="6" fill="#1A1A2E" />
        <circle cx="78" cy="52" r="6" fill="#1A1A2E" />
        <rect x="18" y="48" width="8" height="12" rx="2" fill="#2D3748" />
        <rect x="74" y="48" width="8" height="12" rx="2" fill="#2D3748" />

        {/* Microphone */}
        <path d="M 22 58 Q 16 70 30 75" stroke="#1A1A2E" strokeWidth="3" fill="none" />
        <ellipse cx="32" cy="76" rx="5" ry="4" fill="#2D3748" />
      </svg>
    </div>
  )
}

// Sam - Tech developer with glasses
export function SamAvatar({ className, size = 'md' }: AvatarProps) {
  return (
    <div className={cn(sizes[size], 'rounded-full overflow-hidden', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="samGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#samGradient)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#E8C4A0" />

        {/* Short hair */}
        <path d="M 26 42 Q 26 22 50 22 Q 74 22 74 42 L 74 38 Q 74 20 50 20 Q 26 20 26 38 Z" fill="#2D2D2D" />

        {/* Glasses frame */}
        <rect x="28" y="44" width="18" height="14" rx="3" fill="none" stroke="#1A1A2E" strokeWidth="2.5" />
        <rect x="54" y="44" width="18" height="14" rx="3" fill="none" stroke="#1A1A2E" strokeWidth="2.5" />
        <path d="M 46 50 L 54 50" stroke="#1A1A2E" strokeWidth="2" />

        {/* Eyes behind glasses */}
        <ellipse cx="37" cy="51" rx="3" ry="4" fill="#2D3748" />
        <ellipse cx="63" cy="51" rx="3" ry="4" fill="#2D3748" />
        <circle cx="38" cy="50" r="1" fill="white" />
        <circle cx="64" cy="50" r="1" fill="white" />

        {/* Focused expression - slight smile */}
        <path d="M 42 66 Q 50 71 58 66" stroke="#2D3748" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Code symbols floating */}
        <text x="78" y="28" fill="white" fontSize="10" fontFamily="monospace" opacity="0.7">&lt;/&gt;</text>
      </svg>
    </div>
  )
}

// Sophie - Neuromarketing expert with brain/psychology vibe
export function SophieAvatar({ className, size = 'md' }: AvatarProps) {
  return (
    <div className={cn(sizes[size], 'rounded-full overflow-hidden', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="sophieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#BE185D" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#sophieGradient)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#FCDCC4" />

        {/* Hair - wavy/professional */}
        <path d="M 24 50 Q 22 30 35 24 Q 50 18 65 24 Q 78 30 76 50 Q 78 40 65 32 Q 50 26 35 32 Q 22 40 24 50" fill="#8B4513" />
        <path d="M 24 50 Q 20 55 22 65" stroke="#8B4513" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 76 50 Q 80 55 78 65" stroke="#8B4513" strokeWidth="6" fill="none" strokeLinecap="round" />

        {/* Eyes - insightful look */}
        <ellipse cx="40" cy="50" rx="4" ry="5" fill="#2D3748" />
        <ellipse cx="60" cy="50" rx="4" ry="5" fill="#2D3748" />
        <circle cx="41" cy="49" r="1.5" fill="white" />
        <circle cx="61" cy="49" r="1.5" fill="white" />

        {/* Eyebrows - thoughtful */}
        <path d="M 34 44 Q 40 42 46 44" stroke="#5C4333" strokeWidth="1.5" fill="none" />
        <path d="M 54 44 Q 60 42 66 44" stroke="#5C4333" strokeWidth="1.5" fill="none" />

        {/* Warm smile */}
        <path d="M 40 64 Q 50 72 60 64" stroke="#2D3748" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Brain/insight symbol */}
        <g transform="translate(72, 18) scale(0.4)">
          <path d="M 25 10 Q 10 10 10 25 Q 10 35 20 40 Q 10 45 10 55 Q 10 70 25 70 Q 35 70 40 60 Q 45 70 55 70 Q 70 70 70 55 Q 70 45 60 40 Q 70 35 70 25 Q 70 10 55 10 Q 45 10 40 20 Q 35 10 25 10"
                fill="none" stroke="white" strokeWidth="3" opacity="0.8"/>
          <path d="M 40 20 L 40 60" stroke="white" strokeWidth="2" opacity="0.6"/>
        </g>
      </svg>
    </div>
  )
}

// Generic component to get avatar by assistant slug
export function AssistantAvatar({
  slug,
  className,
  size = 'md'
}: {
  slug: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  switch (slug) {
    case 'max':
      return <MaxAvatar className={className} size={size} />
    case 'sam':
      return <SamAvatar className={className} size={size} />
    case 'sophie':
      return <SophieAvatar className={className} size={size} />
    default:
      // Fallback to colored circle with initial
      return (
        <div className={cn(
          sizes[size],
          'rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-gray-400 to-gray-600',
          className
        )}>
          {slug.charAt(0).toUpperCase()}
        </div>
      )
  }
}
