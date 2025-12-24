import { cn } from '@/lib/utils'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode
}

export function Label({ children, className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'text-sm font-medium text-surface-300',
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}
