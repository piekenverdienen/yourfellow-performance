import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  variant?: 'default' | 'white' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({
  variant = 'default',
  size = 'md',
  className
}: LogoProps) {
  const sizes = {
    sm: { height: 28, width: 140 },
    md: { height: 36, width: 180 },
    lg: { height: 44, width: 220 },
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/yourfellow-logo.svg"
        alt="YourFellow"
        width={sizes[size].width}
        height={sizes[size].height}
        className="object-contain"
        priority
      />
    </div>
  )
}
