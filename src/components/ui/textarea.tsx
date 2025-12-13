'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full rounded-xl border bg-white px-4 py-3 text-sm text-surface-900 min-h-[120px] resize-y',
          'placeholder:text-surface-400',
          'focus:outline-none focus:ring-2 transition-all duration-200',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-surface-300 focus:border-primary focus:ring-primary/20',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
