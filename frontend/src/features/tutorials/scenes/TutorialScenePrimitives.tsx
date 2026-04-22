import React from 'react'

type TutorialPageFrameProps = {
  title: string
  toolbarLabel?: string
  children: React.ReactNode
}

type TutorialCardMockProps = {
  title: string
  subtitle?: string
  accent?: 'primary' | 'soft'
  children?: React.ReactNode
}

type TutorialToolbarMockProps = {
  items: string[]
}

type TutorialSidebarMockProps = {
  items: string[]
}

type TutorialBoardMockProps = {
  columns: Array<{
    title: string
    cards: string[]
  }>
}

const cardAccentClass: Record<NonNullable<TutorialCardMockProps['accent']>, string> = {
  primary: 'border-secondary bg-secondary text-accent',
  soft: 'border-secondary/20 bg-bg text-secondary',
}

export function TutorialPageFrame({ title, toolbarLabel, children }: TutorialPageFrameProps) {
  return (
    <div className="rounded-[2rem] border border-secondary/20 bg-white shadow-[0_32px_80px_rgba(14,68,79,0.12)]">
      <div className="flex items-center justify-between border-b border-secondary/10 px-6 py-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-secondary/50">
            DeckSupervisor
          </p>
          <h4 className="mt-1 text-lg font-semibold text-secondary">{title}</h4>
        </div>
        {toolbarLabel ? (
          <span className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-xs font-semibold text-secondary/70">
            {toolbarLabel}
          </span>
        ) : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function TutorialToolbarMock({ items }: TutorialToolbarMockProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <span
          key={item}
          className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-xs font-semibold text-secondary/70"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export function TutorialSidebarMock({ items }: TutorialSidebarMockProps) {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-2 rounded-[1.5rem] bg-primary p-4 text-accent">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/70">Menu</p>
      {items.map(item => (
        <div
          key={item}
          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold"
        >
          {item}
        </div>
      ))}
    </div>
  )
}

export function TutorialCardMock({
  title,
  subtitle,
  accent = 'soft',
  children,
}: TutorialCardMockProps) {
  return (
    <div className={`rounded-[1.5rem] border p-4 ${cardAccentClass[accent]}`}>
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ? <p className="mt-1 text-xs opacity-75">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

export function TutorialBoardMock({ columns }: TutorialBoardMockProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map(column => (
        <div
          key={column.title}
          className="rounded-[1.5rem] border border-secondary/20 bg-bg p-4"
        >
          <h5 className="text-sm font-semibold text-secondary">{column.title}</h5>
          <div className="mt-3 flex flex-col gap-2">
            {column.cards.map(card => (
              <div
                key={card}
                className="rounded-xl border border-secondary/15 bg-accent px-3 py-2 text-xs font-semibold text-secondary shadow-sm"
              >
                {card}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

type TutorialCalloutPinProps = {
  index: number
  x: number
  y: number
}

export function TutorialCalloutPin({ index, x, y }: TutorialCalloutPinProps) {
  return (
    <span
      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-secondary text-xs font-bold text-accent shadow-md"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      {index}
    </span>
  )
}

type TutorialHighlightBoxProps = {
  x: number
  y: number
  width: number
  height: number
}

export function TutorialHighlightBox({ x, y, width, height }: TutorialHighlightBoxProps) {
  return (
    <span
      className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-secondary/80 bg-secondary/10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      aria-hidden="true"
    />
  )
}
