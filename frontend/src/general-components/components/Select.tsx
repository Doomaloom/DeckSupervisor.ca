import type React from 'react'
import { cn } from '../classNames'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn(
    'min-w-0 max-w-full rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    className,
  )} {...props} />
}
