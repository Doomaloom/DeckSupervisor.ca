import type { HelpOverlayDefinition, ResolvedHelpOverlayTip } from './helpOverlayTypes'

type PageHelpPanelProps = {
  overlay: HelpOverlayDefinition
  tips: ResolvedHelpOverlayTip[]
  activeTipId: string | null
  onClose: () => void
  onSelectTip: (tipId: string | null) => void
  onNext: () => void
  onPrevious: () => void
}

function PageHelpPanel({
  overlay,
  tips,
  activeTipId,
  onClose,
  onSelectTip,
  onNext,
  onPrevious,
}: PageHelpPanelProps) {
  const activeTip = tips.find(tip => tip.id === activeTipId) ?? null

  return (
    <aside
      data-component="page-help-panel"
      className="pointer-events-auto fixed right-6 top-6 z-[92] flex max-h-[calc(100vh-3rem)] w-[22rem] flex-col overflow-hidden rounded-[1.75rem] border border-secondary/20 bg-[#f7f4ed] text-secondary shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
      role="region"
      aria-labelledby="page-help-panel-title"
    >
      <div className="border-b border-secondary/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/60">
              Quick Tips
            </p>
            <h3 id="page-help-panel-title" className="mt-2 text-xl font-semibold">
              {overlay.title}
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
        <div className="mt-4" aria-live="polite">
          {activeTip ? (
            <>
              <h4 className="text-lg font-semibold">{activeTip.title}</h4>
              <div className="mt-2 space-y-2 text-sm leading-6 text-secondary/80">
                {activeTip.body.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="text-lg font-semibold">{overlay.introTitle}</h4>
              <div className="mt-2 space-y-2 text-sm leading-6 text-secondary/80">
                {overlay.introBody.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="font-medium text-secondary">Click a numbered area on the page to open a tip.</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-2">
          {tips.map((tip, index) => {
            const isActive = tip.id === activeTipId
            return (
              <button
                key={tip.id}
                type="button"
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  isActive
                    ? 'border-primary bg-primary/10 text-secondary'
                    : 'border-secondary/15 bg-bg text-secondary hover:border-secondary/40'
                }`}
                onClick={() => onSelectTip(tip.id)}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-semibold">{tip.title}</span>
                  <span className="mt-1 block text-secondary/70">
                    {tip.body[0]}
                  </span>
                </span>
              </button>
            )
          })}
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
    </aside>
  )
}

export default PageHelpPanel
