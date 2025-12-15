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
      viewBox="0 0 100 80"
      className={className}
      fill={fill}
    >
      {/* Left part - Y shape forming elephant head with curling trunk */}
      <path d="
        M 8 0
        C 3 0, 0 4, 0 10
        L 0 50
        C 0 68, 14 80, 32 80
        C 50 80, 58 68, 58 50
        L 58 44
        C 58 36, 50 30, 42 34
        C 36 38, 34 44, 34 50
        C 34 58, 28 62, 22 58
        C 16 54, 16 46, 16 40
        L 16 10
        C 16 4, 13 0, 8 0
        Z
      "/>

      {/* Dot - elephant's eye */}
      <circle cx="50" cy="10" r="7" />

      {/* Right part - f shape with elegant curve */}
      <path d="
        M 68 8
        C 68 3, 72 0, 78 0
        C 88 0, 94 8, 94 18
        L 94 22
        L 80 22
        L 80 18
        C 80 14, 78 12, 76 14
        C 74 16, 74 20, 74 24
        L 74 52
        C 74 62, 80 68, 88 68
        C 94 68, 98 64, 100 58
        L 100 68
        C 96 76, 88 80, 78 80
        C 64 80, 56 68, 56 52
        L 56 24
        C 56 14, 60 8, 68 8
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
