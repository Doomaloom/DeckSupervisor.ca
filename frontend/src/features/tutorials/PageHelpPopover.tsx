import { useEffect, useState, useRef } from 'react'
import type { ResolvedHelpOverlayTip } from './helpOverlayTypes'

type PageHelpPopoverProps = {
  tip: ResolvedHelpOverlayTip
  currentIndex: number
  totalTips: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

function PageHelpPopover({
  tip,
  currentIndex,
  totalTips,
  onClose,
  onNext,
  onPrevious,
}: PageHelpPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ top?: number; left?: number; bottom?: number; right?: number }>({})

  // Calculate position so it doesn't overflow the viewport
  useEffect(() => {
    if (!popoverRef.current) return

    const popoverRect = popoverRef.current.getBoundingClientRect()
    const padding = 16
    const { highlightRect } = tip

    let top: number | undefined
    let left: number | undefined

    // Default: try placing it to the right
    if (highlightRect.right + popoverRect.width + padding < window.innerWidth) {
      left = highlightRect.right + padding
      top = highlightRect.top
    }
    // Try placing it to the left
    else if (highlightRect.left - popoverRect.width - padding > 0) {
      left = highlightRect.left - popoverRect.width - padding
      top = highlightRect.top
    }
    // Try placing it below
    else if (highlightRect.bottom + popoverRect.height + padding < window.innerHeight) {
      top = highlightRect.bottom + padding
      left = Math.max(padding, Math.min(highlightRect.left, window.innerWidth - popoverRect.width - padding))
    }
    // Try placing it above
    else if (highlightRect.top - popoverRect.height - padding > 0) {
      top = highlightRect.top - popoverRect.height - padding
      left = Math.max(padding, Math.min(highlightRect.left, window.innerWidth - popoverRect.width - padding))
    }
    // Fallback: center it on the screen
    else {
      top = Math.max(padding, (window.innerHeight - popoverRect.height) / 2)
      left = Math.max(padding, (window.innerWidth - popoverRect.width) / 2)
    }

    // Ensure vertical bounds
    if (top !== undefined) {
        if (top + popoverRect.height + padding > window.innerHeight) {
            top = window.innerHeight - popoverRect.height - padding
        }
        if (top < padding) {
            top = padding
        }
    }

    setStyle({ top, left })
  }, [tip])

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] flex w-80 flex-col overflow-hidden rounded-2xl bg-accent shadow-2xl ring-1 ring-secondary/5 pointer-events-auto transition-all duration-300 ease-in-out"
      style={{
        ...style,
        ...(Object.keys(style).length === 0 ? { opacity: 0 } : { opacity: 1 }),
      }}
      role="dialog"
      aria-labelledby="help-popover-title"
    >
      <div className="flex items-start justify-between px-5 py-4 border-b border-secondary/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Tip {currentIndex + 1} of {totalTips}
          </p>
          <h3 id="help-popover-title" className="mt-1 text-lg font-bold text-secondary">
            {tip.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full p-1 text-secondary/40 hover:bg-bg hover:text-secondary transition-colors"
          aria-label="Close help"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 text-sm leading-relaxed text-secondary/70">
        {tip.body.map((paragraph, i) => (
          <p key={paragraph} className={i > 0 ? 'mt-3' : ''}>
            {paragraph}
          </p>
        ))}
      </div>

      <div className="flex items-center justify-between bg-bg/80 px-5 py-4 border-t border-secondary/10">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className={`text-sm font-medium transition-colors ${
            currentIndex === 0 ? 'text-secondary/20 cursor-not-allowed' : 'text-secondary/60 hover:text-secondary'
          }`}
        >
          Previous
        </button>
        
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-accent transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {currentIndex === totalTips - 1 ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  )
}

export default PageHelpPopover
