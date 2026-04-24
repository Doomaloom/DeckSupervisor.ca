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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] border-2 border-secondary/20 bg-bg text-secondary shadow-[0_32px_120px_rgba(0,0,0,0.3)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-modal-title"
      >
        {/* Header */}
        <div className={`relative overflow-hidden border-b border-secondary/10 bg-gradient-to-br from-accent via-bg to-accent px-6 sm:px-10 transition-all duration-500 ${tutorialId ? 'py-5' : 'py-8'}`}>
          <div className="absolute -right-14 -top-12 h-40 w-40 rounded-full bg-secondary/10" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          
          <div className="flex items-center justify-between">
            <div className="relative">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-secondary/50">
                Help / Tutorials
              </p>
              <h3 id="tutorial-modal-title" className={`mt-1 font-bold transition-all ${tutorialId ? 'text-xl' : 'text-3xl'}`}>
                {modalTitle}
              </h3>
            </div>
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/20 bg-accent text-sm font-bold text-secondary transition hover:-translate-y-0.5 hover:border-secondary hover:bg-bg shadow-sm"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          
          {!tutorialId && (
            <p className="relative mt-4 max-w-2xl text-sm leading-relaxed text-secondary/70">
              {modalSummary}
            </p>
          )}
        </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
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
