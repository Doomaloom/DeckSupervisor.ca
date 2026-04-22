import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PageHelpBottomSheet from './PageHelpBottomSheet'
import PageHelpPanel from './PageHelpPanel'
import PageHelpPins from './PageHelpPins'
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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !overlay || !isReady) {
      return
    }
    if (resolvedTips.length === 0) {
      onUnavailable()
    }
  }, [isOpen, isReady, onUnavailable, overlay, resolvedTips.length])

  useEffect(() => {
    if (!activeTipId) {
      return
    }
    if (!resolvedTips.some(tip => tip.id === activeTipId)) {
      onSelectTip(null)
    }
  }, [activeTipId, onSelectTip, resolvedTips])

  const highlightBoxes = useMemo(
    () =>
      resolvedTips.map(tip => (
        <div
          key={`highlight-${tip.id}`}
          aria-hidden="true"
          className="fixed z-[90] rounded-2xl border-2 border-primary/80 bg-primary/10 shadow-[0_0_0_1px_rgba(14,75,92,0.18)]"
          style={{
            left: `${tip.highlightRect.left}px`,
            top: `${tip.highlightRect.top}px`,
            width: `${tip.highlightRect.width}px`,
            height: `${tip.highlightRect.height}px`,
          }}
        />
      )),
    [resolvedTips],
  )

  const handleNext = () => {
    if (resolvedTips.length === 0) {
      return
    }

    if (!activeTipId) {
      onSelectTip(resolvedTips[0].id)
      return
    }

    const currentIndex = resolvedTips.findIndex(tip => tip.id === activeTipId)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % resolvedTips.length
    onSelectTip(resolvedTips[nextIndex].id)
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
    const previousIndex =
      currentIndex === -1 ? resolvedTips.length - 1 : (currentIndex - 1 + resolvedTips.length) % resolvedTips.length
    onSelectTip(resolvedTips[previousIndex].id)
  }

  if (!isOpen || !overlay) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[89]" data-component="page-help-overlay">
      <div className="absolute inset-0 bg-black/18" aria-hidden="true" />
      {highlightBoxes}
      <PageHelpPins tips={resolvedTips} activeTipId={activeTipId} onSelectTip={tipId => onSelectTip(tipId)} />
      {isMobile ? (
        <PageHelpBottomSheet
          overlay={overlay}
          tips={resolvedTips}
          activeTipId={activeTipId}
          onClose={onClose}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      ) : (
        <PageHelpPanel
          overlay={overlay}
          tips={resolvedTips}
          activeTipId={activeTipId}
          onClose={onClose}
          onSelectTip={onSelectTip}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}
    </div>,
    document.body,
  )
}

export default PageHelpOverlay
