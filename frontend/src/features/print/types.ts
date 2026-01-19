import type { ComponentType, SVGProps } from 'react'

export type PrintOptionKey = 'day1' | 'instructors' | 'masterlist' | 'schematic'

export type PrintOption = {
  key: PrintOptionKey
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}
