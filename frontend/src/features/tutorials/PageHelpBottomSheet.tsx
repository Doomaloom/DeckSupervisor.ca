import type { HelpOverlayDefinition, ResolvedHelpOverlayTip } from './helpOverlayTypes'

type PageHelpBottomSheetProps = {
  overlay: HelpOverlayDefinition
  tips: ResolvedHelpOverlayTip[]
  activeTipId: string | null
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

function PageHelpBottomSheet({
  overlay,
  tips,
  activeTipId,
  onClose,
  onNext,
  onPrevious,
}: PageHelpBottomSheetProps) {
  const activeTip = tips.find(tip => tip.id === activeTipId) ?? null

  return (
    <section
      data-component="page-help-bottom-sheet"
      className="pointer-events-auto fixed inset-x-3 bottom-3 z-[92] rounded-[1.75rem] border border-secondary/20 bg-[#f7f4ed] text-secondary shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
      aria-labelledby="page-help-bottom-sheet-title"
    >
      <div className="px-5 py-4">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-secondary/20" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/60">
              Quick Tips
            </p>
            <h3 id="page-help-bottom-sheet-title" className="mt-2 text-lg font-semibold">
              {activeTip ? activeTip.title : overlay.introTitle}
            </h3>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/20 bg-bg text-sm font-semibold transition hover:-translate-y-0.5 hover:border-secondary"
            onClick={onClose}
            aria-label="Close page help"
          >
            X
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-secondary/80" aria-live="polite">
          {(activeTip ? activeTip.body : overlay.introBody).map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {!activeTip ? (
            <p className="font-medium text-secondary">Tap a numbered area on the page to open a tip.</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-secondary/10 px-5 py-4">
        <button
          type="button"
          className="rounded-2xl border border-secondary/20 bg-bg px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-secondary"
          onClick={onPrevious}
        >
          Previous Tip
        </button>
        <button
          type="button"
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
          onClick={onNext}
        >
          Next Tip
        </button>
      </div>
    </section>
  )
}

export default PageHelpBottomSheet
