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
    <div className={cn(sizes[size], 'rounded-full overflow-hidden flex-shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="maxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFCC" />
            <stop offset="100%" stopColor="#00D4AA" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#maxGrad)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#FFE0C2" />

        {/* Hair */}
        <path d="M25 45 Q25 25 50 22 Q75 25 75 45 L75 35 Q75 18 50 15 Q25 18 25 35 Z" fill="#4A3728" />

        {/* Eyes */}
        <ellipse cx="40" cy="50" rx="4" ry="5" fill="#2D2D2D" />
        <ellipse cx="60" cy="50" rx="4" ry="5" fill="#2D2D2D" />
        <circle cx="41" cy="49" r="1.5" fill="white" />
        <circle cx="61" cy="49" r="1.5" fill="white" />

        {/* Friendly smile */}
        <path d="M40 62 Q50 70 60 62" fill="none" stroke="#E07A5F" strokeWidth="2.5" strokeLinecap="round" />

        {/* Headset */}
        <path d="M22 48 Q20 35 35 30" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M78 48 Q80 35 65 30" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <circle cx="22" cy="52" r="6" fill="#333" />
        <circle cx="78" cy="52" r="6" fill="#333" />

        {/* Microphone */}
        <path d="M22 58 Q15 65 20 72" fill="none" stroke="#333" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="74" r="4" fill="#333" />
      </svg>
    </div>
  )
}

// Sam - Developer assistant with glasses
export function SamAvatar({ className, size = 'md' }: AvatarProps) {
  return (
    <div className={cn(sizes[size], 'rounded-full overflow-hidden flex-shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="samGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#samGrad)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#F5D0B5" />

        {/* Hair - shorter, neat */}
        <path d="M26 42 Q26 22 50 20 Q74 22 74 42 L74 32 Q74 16 50 14 Q26 16 26 32 Z" fill="#2D2D2D" />

        {/* Glasses */}
        <rect x="30" y="44" width="16" height="14" rx="3" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
        <rect x="54" y="44" width="16" height="14" rx="3" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
        <path d="M46 50 L54 50" stroke="#1a1a1a" strokeWidth="2" />
        <path d="M30 48 L24 46" stroke="#1a1a1a" strokeWidth="2" />
        <path d="M70 48 L76 46" stroke="#1a1a1a" strokeWidth="2" />

        {/* Eyes behind glasses */}
        <ellipse cx="38" cy="51" rx="3" ry="4" fill="#2D2D2D" />
        <ellipse cx="62" cy="51" rx="3" ry="4" fill="#2D2D2D" />

        {/* Slight smile */}
        <path d="M42 65 Q50 70 58 65" fill="none" stroke="#C97B63" strokeWidth="2" strokeLinecap="round" />

        {/* Code brackets decoration */}
        <text x="15" y="85" fill="white" fontSize="14" fontFamily="monospace" opacity="0.6">{'</'}</text>
        <text x="72" y="85" fill="white" fontSize="14" fontFamily="monospace" opacity="0.6">{'>'}</text>
      </svg>
    </div>
  )
}

// Sophie - Neuromarketing expert with creative vibe
export function SophieAvatar({ className, size = 'md' }: AvatarProps) {
  return (
    <div className={cn(sizes[size], 'rounded-full overflow-hidden flex-shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background gradient */}
        <defs>
          <linearGradient id="sophieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#BE185D" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#sophieGrad)" />

        {/* Face */}
        <circle cx="50" cy="52" r="28" fill="#FFE4D0" />

        {/* Hair - wavy/creative */}
        <path d="M22 55 Q18 35 30 25 Q40 18 50 18 Q60 18 70 25 Q82 35 78 55
                 Q78 45 70 38 Q60 32 50 32 Q40 32 30 38 Q22 45 22 55" fill="#8B4513" />
        <path d="M22 55 Q20 48 25 42" fill="none" stroke="#8B4513" strokeWidth="4" strokeLinecap="round" />
        <path d="M78 55 Q80 48 75 42" fill="none" stroke="#8B4513" strokeWidth="4" strokeLinecap="round" />

        {/* Eyes - more expressive */}
        <ellipse cx="40" cy="50" rx="4" ry="5" fill="#2D2D2D" />
        <ellipse cx="60" cy="50" rx="4" ry="5" fill="#2D2D2D" />
        <circle cx="41" cy="49" r="2" fill="white" />
        <circle cx="61" cy="49" r="2" fill="white" />

        {/* Eyelashes */}
        <path d="M35 45 L33 42 M37 44 L36 41 M39 44 L39 41" stroke="#2D2D2D" strokeWidth="1" />
        <path d="M65 45 L67 42 M63 44 L64 41 M61 44 L61 41" stroke="#2D2D2D" strokeWidth="1" />

        {/* Warm smile */}
        <path d="M40 63 Q50 72 60 63" fill="none" stroke="#D4776C" strokeWidth="2.5" strokeLinecap="round" />

        {/* Brain/lightbulb icon */}
        <circle cx="78" cy="25" r="10" fill="white" fillOpacity="0.2" />
        <path d="M78 20 L78 25 M75 28 L78 25 L81 28" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  )
}

// Generic assistant avatar selector
interface AssistantAvatarProps extends AvatarProps {
  slug: string
}

export function AssistantAvatar({ slug, ...props }: AssistantAvatarProps) {
  switch (slug) {
    case 'max':
      return <MaxAvatar {...props} />
    case 'sam':
      return <SamAvatar {...props} />
    case 'sophie':
      return <SophieAvatar {...props} />
    default:
      // Fallback to a generic avatar
      return (
        <div className={cn(sizes[props.size || 'md'], 'rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-black font-bold flex-shrink-0', props.className)}>
          ?
        </div>
      )
  }
}
