import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  variant?: 'default' | 'white'
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
    sm: { icon: 20, text: 'text-base' },
    md: { icon: 28, text: 'text-xl' },
    lg: { icon: 36, text: 'text-2xl' },
  }

  // Use different logo files for different variants
  const logoSrc = variant === 'white'
    ? '/logos/yourfellow-white.svg'
    : '/logos/yourfellow.svg'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src={logoSrc}
        alt="YourFellow"
        width={sizes[size].icon * 1.5}
        height={sizes[size].icon}
        className="flex-shrink-0"
        priority
      />
      {showText && (
        <span className={cn(
          'font-bold tracking-tight',
          sizes[size].text,
          variant === 'white' ? 'text-white' : 'text-surface-900'
        )}>
          yourfellow
        </span>
      )}
    </div>
  )
}
