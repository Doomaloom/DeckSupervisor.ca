import { useEffect, useMemo, useRef } from 'react'
import TutorialCatalog from './TutorialCatalog'
import { tutorialRegistry } from './tutorialRegistry'
import TutorialViewer from './TutorialViewer'
import type { TutorialCatalogMode, TutorialId } from './types'

type TutorialModalProps = {
  isOpen: boolean
  tutorialId: TutorialId | null
  activeStepIndex: number
  openedFromPath: string
  catalogMode: TutorialCatalogMode
  onClose: () => void
  onOpenTutorial: (tutorialId: TutorialId, stepIndex?: number) => void
  onSetStep: (index: number) => void
  onNext: () => void
  onPrevious: () => void
}

function TutorialModal({
  isOpen,
  tutorialId,
  activeStepIndex,
  openedFromPath,
  catalogMode,
  onClose,
  onOpenTutorial,
  onSetStep,
  onNext,
  onPrevious,
}: TutorialModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  const modalTitle = useMemo(() => {
    if (!tutorialId) {
      return 'Help / Tutorials'
    }
    return tutorialRegistry[tutorialId].title
  }, [tutorialId])

  const modalSummary = useMemo(() => {
    if (!tutorialId) {
      return 'Browse tutorials for the app’s part-time workflows.'
    }
    return tutorialRegistry[tutorialId].shortDescription
  }, [tutorialId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusables?.[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panel) {
        return
      }

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(item => !item.hasAttribute('disabled'))

      if (items.length === 0) {
        return
      }

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border-2 border-secondary/20 bg-[#f7f4ed] text-secondary shadow-[0_32px_120px_rgba(0,0,0,0.25)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-modal-title"
      >
        <div className="relative overflow-hidden border-b border-secondary/10 bg-gradient-to-br from-accent via-[#f7f4ed] to-[#e8f0f0] px-6 py-6 sm:px-8">
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-secondary/10" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <button
            type="button"
            className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/20 bg-bg text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary"
            onClick={onClose}
            aria-label="Close tutorials"
          >
            X
          </button>
          <p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-secondary/60">
            Help / Tutorials
          </p>
          <h3 id="tutorial-modal-title" className="relative mt-2 text-3xl font-semibold">
            {modalTitle}
          </h3>
          <p className="relative mt-2 max-w-3xl text-sm leading-6 text-secondary/80">
            {modalSummary}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {tutorialId ? (
            <TutorialViewer
              tutorialId={tutorialId}
              activeStepIndex={activeStepIndex}
              onOpenTutorial={onOpenTutorial}
              onSetStep={onSetStep}
              onNext={onNext}
              onPrevious={onPrevious}
            />
          ) : (
            <TutorialCatalog
              mode={catalogMode}
              pathname={openedFromPath}
              onOpenTutorial={onOpenTutorial}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default TutorialModal
