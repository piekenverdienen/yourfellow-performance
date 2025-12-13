'use client'

import { cn } from '@/lib/utils'

export interface ProgressProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  variant?: 'default' | 'primary' | 'success'
  className?: string
}

export function Progress({ 
  value, 
  max = 100, 
  size = 'md', 
  showLabel = false,
  variant = 'primary',
  className 
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const variants = {
    default: 'bg-surface-400',
    primary: 'bg-gradient-brand',
    success: 'bg-green-500',
  }

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-surface-200 rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variants[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-surface-500">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  )
}
