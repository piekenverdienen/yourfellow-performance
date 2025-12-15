import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'default' | 'white' | 'dark' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

// YourFellow logo icon - stylized YF elephant shape
function LogoIcon({ className, fill = 'currentColor' }: { className?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 90 72"
      className={className}
      fill={fill}
    >
      {/* Left part - Y shape forming elephant head with curling trunk */}
      <path d="
        M 6 0
        C 2 0, 0 3, 0 8
        L 0 44
        C 0 60, 12 72, 28 72
        C 44 72, 52 60, 52 44
        L 52 40
        C 52 32, 44 28, 38 32
        C 32 36, 30 42, 30 48
        C 30 54, 26 58, 20 56
        C 14 54, 12 48, 12 40
        L 12 8
        C 12 3, 10 0, 6 0
        Z
      "/>

      {/* Dot - elephant's eye */}
      <circle cx="44" cy="8" r="6" />

      {/* Right part - f shape with curved hook at top */}
      <path d="
        M 72 0
        C 80 0, 86 6, 86 14
        L 86 16
        L 74 16
        L 74 14
        C 74 10, 72 8, 70 10
        C 68 12, 68 16, 68 20
        L 68 46
        C 68 58, 76 66, 86 64
        L 90 64
        L 90 72
        C 88 72, 84 72, 80 72
        C 64 72, 56 60, 56 44
        L 56 20
        C 56 8, 62 0, 72 0
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
    primary: { fill: '#00FFCC', textColor: 'text-primary' },
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
