import type React from 'react'
import { cn } from '../classNames'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRowsClassName?: string
}

export function Textarea({
  minRowsClassName = 'min-h-[120px]',
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        minRowsClassName,
        'rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
