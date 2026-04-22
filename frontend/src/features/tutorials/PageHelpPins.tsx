import type { ResolvedHelpOverlayTip } from './helpOverlayTypes'

type PageHelpPinsProps = {
  tips: ResolvedHelpOverlayTip[]
  activeTipId: string | null
  onSelectTip: (tipId: string) => void
}

function PageHelpPins({ tips, activeTipId, onSelectTip }: PageHelpPinsProps) {
  return (
    <>
      {tips.map((tip, index) => {
        const isActive = tip.id === activeTipId
        return (
          <button
            key={tip.id}
            type="button"
            className={`pointer-events-auto fixed z-[91] inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-lg transition ${
              isActive
                ? 'border-primary bg-primary text-white'
                : 'border-secondary bg-[#f7f4ed] text-secondary hover:-translate-y-0.5'
            }`}
            style={{
              left: `${tip.pinX}px`,
              top: `${tip.pinY}px`,
            }}
            onClick={() => onSelectTip(tip.id)}
            aria-label={`Tip ${index + 1}: ${tip.title}`}
          >
            {index + 1}
          </button>
        )
      })}
    </>
  )
}

export default PageHelpPins
