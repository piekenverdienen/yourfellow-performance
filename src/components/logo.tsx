import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'default' | 'white' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

// YourFellow logo icon - stylized YF elephant shape
function LogoIcon({ className, fill = 'currentColor' }: { className?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={className}
      fill={fill}
    >
      {/* Left part - curved Y shape like elephant's head and trunk */}
      <path d="
        M 12 2
        C 4 2, 0 8, 0 16
        L 0 60
        C 0 80, 16 96, 36 96
        C 56 96, 68 80, 68 60
        L 68 50
        C 68 42, 60 36, 52 36
        C 44 36, 36 44, 36 52
        C 36 64, 24 72, 16 60
        C 10 50, 16 42, 16 34
        L 16 16
        C 16 8, 12 2, 12 2
        Z
      "/>

      {/* Dot - elephant's eye */}
      <circle cx="52" cy="14" r="10" />

      {/* Right part - curved F shape flowing right */}
      <path d="
        M 76 2
        L 76 60
        C 76 72, 88 80, 100 72
        C 106 68, 108 60, 108 52
        L 108 40
        C 108 32, 100 28, 94 34
        C 90 38, 90 44, 90 48
        C 90 52, 94 54, 98 50
        L 98 48
        L 92 48
        L 92 24
        C 92 16, 96 10, 102 6
        L 102 2
        L 92 2
        L 92 8
        C 88 4, 84 2, 76 2
        Z
      "/>
    </svg>
  )
}

export function Logo({
  variant = 'default',
  size = 'md',
  showText = true,
  className
}: LogoProps) {
  const sizes = {
    sm: { icon: 'h-5', text: 'text-base' },
    md: { icon: 'h-7', text: 'text-xl' },
    lg: { icon: 'h-9', text: 'text-2xl' },
  }

  const variants = {
    default: { fill: '#000000', textColor: 'text-surface-900' },
    white: { fill: '#FFFFFF', textColor: 'text-white' },
    dark: { fill: '#000000', textColor: 'text-surface-900' },
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoIcon
        className={cn(sizes[size].icon, 'w-auto flex-shrink-0')}
        fill={variants[variant].fill}
      />
      {showText && (
        <div className="flex items-baseline">
          <span className={cn(
            'font-bold tracking-tight',
            sizes[size].text,
            variants[variant].textColor
          )}>
            yourfellow
          </span>
        </div>
      )}
    </div>
  )
}
