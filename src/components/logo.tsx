import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'default' | 'white' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ 
  variant = 'default', 
  size = 'md', 
  showText = true,
  className 
}: LogoProps) {
  const sizes = {
    sm: { box: 'w-8 h-8', text: 'text-sm', logo: 'text-lg' },
    md: { box: 'w-10 h-10', text: 'text-base', logo: 'text-xl' },
    lg: { box: 'w-12 h-12', text: 'text-lg', logo: 'text-2xl' },
  }

  const variants = {
    default: { 
      box: 'bg-primary', 
      logoText: 'text-black', 
      brandText: 'text-surface-900' 
    },
    white: { 
      box: 'bg-white', 
      logoText: 'text-primary', 
      brandText: 'text-white' 
    },
    dark: { 
      box: 'bg-primary', 
      logoText: 'text-black', 
      brandText: 'text-white' 
    },
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div 
        className={cn(
          'rounded-xl flex items-center justify-center font-bold',
          sizes[size].box,
          sizes[size].logo,
          variants[variant].box,
          variants[variant].logoText
        )}
      >
        YF
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            'font-bold leading-tight',
            sizes[size].text,
            variants[variant].brandText
          )}>
            YourFellow
          </span>
          <span className={cn(
            'text-xs opacity-70',
            variants[variant].brandText
          )}>
            Performance
          </span>
        </div>
      )}
    </div>
  )
}
