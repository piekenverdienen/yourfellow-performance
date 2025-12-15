import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'default' | 'white' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

// Professional YourFellow logo mark SVG
function LogoMark({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'white' | 'dark' }) {
  const fillColor = variant === 'white' ? '#00FFCC' : '#000000'
  const bgColor = variant === 'white' ? '#ffffff' : '#00FFCC'

  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background rounded square */}
      <rect width="40" height="40" rx="10" fill={bgColor} />

      {/* Stylized "YF" mark - Y as arrow pointing up (growth), F integrated */}
      <path
        d="M12 12 L20 22 L20 28 M28 12 L20 22"
        stroke={fillColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* F horizontal lines */}
      <path
        d="M23 16 L30 16 M23 22 L28 22"
        stroke={fillColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Small accent dot */}
      <circle cx="32" cy="28" r="2.5" fill={fillColor} />
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
    sm: { box: 'w-8 h-8', text: 'text-sm' },
    md: { box: 'w-10 h-10', text: 'text-base' },
    lg: { box: 'w-12 h-12', text: 'text-lg' },
  }

  const variants = {
    default: {
      brandText: 'text-surface-900'
    },
    white: {
      brandText: 'text-white'
    },
    dark: {
      brandText: 'text-white'
    },
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark className={sizes[size].box} variant={variant} />
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            'font-bold leading-tight tracking-tight',
            sizes[size].text,
            variants[variant].brandText
          )}>
            YourFellow
          </span>
          <span className={cn(
            'text-xs font-medium',
            variant === 'default' ? 'text-primary' : 'text-primary/80'
          )}>
            Performance
          </span>
        </div>
      )}
    </div>
  )
}
