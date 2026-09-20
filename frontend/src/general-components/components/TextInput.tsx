import type React from 'react'
import { cn } from '../classNames'

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  tone?: 'default' | 'accent'
}

const toneClasses: Record<NonNullable<TextInputProps['tone']>, string> = {
  default: 'bg-bg',
  accent: 'bg-accent',
}

export function TextInput({ tone = 'default', className, ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        'rounded-2xl border-2 border-secondary px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 disabled:cursor-not-allowed disabled:opacity-60',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
