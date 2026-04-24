import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PageHelpPopover from './PageHelpPopover'
import { useHelpOverlayLayout } from './hooks/useHelpOverlayLayout'
import type { HelpOverlayId } from './helpOverlayTypes'

type PageHelpOverlayProps = {
  isOpen: boolean
  overlayId: HelpOverlayId | null
  activeTipId: string | null
  onClose: () => void
  onSelectTip: (tipId: string | null) => void
  onUnavailable: () => void
}

function PageHelpOverlay({
  isOpen,
  overlayId,
  activeTipId,
  onClose,
  onSelectTip,
  onUnavailable,
}: PageHelpOverlayProps) {
  const { overlay, resolvedTips, isReady } = useHelpOverlayLayout(overlayId, isOpen)
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        handleNext()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, resolvedTips, activeTipId])

  useEffect(() => {
    if (!isOpen || !overlay || !isReady) {
      return
    }
    if (resolvedTips.length === 0) {
      onUnavailable()
    } else if (!activeTipId) {
      // Auto-select the first tip if none is selected
      onSelectTip(resolvedTips[0].id)
    }
  }, [isOpen, isReady, onUnavailable, overlay, resolvedTips.length, activeTipId, onSelectTip])

  useEffect(() => {
    if (!activeTipId) {
      return
    }
    if (!resolvedTips.some(tip => tip.id === activeTipId)) {
      onSelectTip(resolvedTips[0]?.id ?? null)
    }
  }, [activeTipId, onSelectTip, resolvedTips])

  const handleNext = () => {
    if (resolvedTips.length === 0) {
      return
    }

    if (!activeTipId) {
      onSelectTip(resolvedTips[0].id)
      return
    }

    const currentIndex = resolvedTips.findIndex(tip => tip.id === activeTipId)
    if (currentIndex === resolvedTips.length - 1) {
      // Reached the end, close the overlay
      onClose()
    } else {
      const nextIndex = (currentIndex + 1) % resolvedTips.length
      onSelectTip(resolvedTips[nextIndex].id)
    }
  }

  const handlePrevious = () => {
    if (resolvedTips.length === 0) {
      return
    }

    if (!activeTipId) {
      onSelectTip(resolvedTips[resolvedTips.length - 1].id)
      return
    }

    const currentIndex = resolvedTips.findIndex(tip => tip.id === activeTipId)
    // Don't wrap around backwards
    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1
      onSelectTip(resolvedTips[previousIndex].id)
    }
  }

  const activeTip = resolvedTips.find(tip => tip.id === activeTipId)
  const activeIndex = resolvedTips.findIndex(tip => tip.id === activeTipId)

  // Spotlight Effect Component
  const spotlightMask = useMemo(() => {
    if (!activeTip) return null

    const { highlightRect } = activeTip
    const { width, height } = windowSize
    
    // Add border radius to the cutout via SVG rx/ry
    return (
      <svg
        className="absolute inset-0 pointer-events-none transition-all duration-300 ease-in-out"
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White covers the entire screen (opaque in mask) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black punches a hole (transparent in mask) */}
            <rect
              x={highlightRect.left}
              y={highlightRect.top}
              width={highlightRect.width}
              height={highlightRect.height}
              rx="12"
              ry="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.45)"
          mask="url(#spotlight-mask)"
        />
        {/* Soft glowing border around the cutout */}
        <rect
          x={highlightRect.left - 2}
          y={highlightRect.top - 2}
          width={highlightRect.width + 4}
          height={highlightRect.height + 4}
          rx="14"
          ry="14"
          fill="none"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="2"
        />
      </svg>
    )
  }, [activeTip, windowSize])

  if (!isOpen || !overlay || !isReady) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[89]" data-component="page-help-overlay">
      {spotlightMask}
      
      {activeTip && (
        <PageHelpPopover
          key={activeTip.id} // Re-render when tip changes to reset animations if needed
          tip={activeTip}
          currentIndex={activeIndex}
          totalTips={resolvedTips.length}
          onClose={onClose}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}
    </div>,
    document.body,
  )
}

export default PageHelpOverlay
