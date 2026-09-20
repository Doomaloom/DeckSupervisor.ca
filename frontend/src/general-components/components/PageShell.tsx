import type React from 'react'
import { cn } from '../classNames'

export type PageShellMaxWidth = 'xl' | '2xl' | '5xl' | '6xl' | '7xl'

export type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  maxWidth?: PageShellMaxWidth
}

const maxWidthClasses: Record<PageShellMaxWidth, string> = {
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
}

export function PageShell({ maxWidth = '6xl', className, ...props }: PageShellProps) {
  return <div className={cn('mx-auto flex w-full flex-col gap-6', maxWidthClasses[maxWidth], className)} {...props} />
}
