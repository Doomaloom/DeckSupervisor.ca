import { tutorialRegistry } from './tutorialRegistry'
import TutorialStepRenderer from './TutorialStepRenderer'
import type { TutorialId } from './types'

type TutorialViewerProps = {
  tutorialId: TutorialId
  activeStepIndex: number
  onOpenTutorial: (tutorialId: TutorialId) => void
  onSetStep: (index: number) => void
  onNext: () => void
  onPrevious: () => void
}

function TutorialViewer({
  tutorialId,
  activeStepIndex,
  onOpenTutorial,
  onNext,
  onPrevious,
}: TutorialViewerProps) {
  const tutorial = tutorialRegistry[tutorialId]
  const step = tutorial.steps[activeStepIndex]
  const isFirstStep = activeStepIndex === 0
  const isLastStep = activeStepIndex === tutorial.steps.length - 1

  return (
    <div className="mx-auto flex w-full flex-col gap-5">
      {/* Header Info - Compact */}
      <div className="flex items-end justify-between px-1">
        <div className="flex flex-col">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-secondary/40">
            Step {activeStepIndex + 1} of {tutorial.steps.length}
          </p>
          <h4 className="mt-0.5 text-xl font-bold text-secondary">{step.title}</h4>
        </div>
        <div className="mb-1 flex gap-1">
          {tutorial.steps.map((_, index) => (
            <div
              key={`dot-${index}`}
              className={`h-1 w-3 rounded-full transition-colors ${
                index === activeStepIndex ? 'bg-secondary' : 'bg-secondary/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Content Area - Reduced Padding and Gaps */}
      <section className="flex flex-col gap-5">
        {/* Graphic Area - Better use of space */}
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[2rem] border border-secondary/10 bg-bg shadow-sm flex items-center justify-center"
          aria-live="polite"
        >
          <div className="w-full h-full transform-gpu transition-transform duration-500">
             <TutorialStepRenderer step={step} onOpenTutorial={onOpenTutorial} />
          </div>
        </div>

        {/* Text Content - More compact layout */}
        <div className="px-1">
          <div className="text-sm leading-relaxed text-secondary/70">
            {step.kind === 'scene' || step.kind === 'intro' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {step.body.map((paragraph, i) => (
                  <p key={`p-${i}`} className={i === 0 ? "font-medium text-secondary/80" : ""}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <TutorialStepRenderer step={step} onOpenTutorial={onOpenTutorial} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Navigation Footer - Tighter */}
      <div className="mt-1 flex items-center justify-between border-t border-secondary/10 pt-5">
        <button
          type="button"
          className="rounded-xl border border-secondary/20 bg-accent px-5 py-2 text-sm font-bold text-secondary transition hover:-translate-y-0.5 hover:border-secondary disabled:cursor-not-allowed disabled:opacity-30"
          onClick={onPrevious}
          disabled={isFirstStep}
        >
          Previous
        </button>
        
        <div className="hidden flex-1 justify-center sm:flex px-4">
           {tutorial.prerequisites?.length && isFirstStep ? (
             <p className="text-center text-[0.6rem] font-semibold text-secondary/40">
               Prerequisite: {tutorial.prerequisites[0]}
             </p>
           ) : null}
        </div>

        <button
          type="button"
          className="rounded-xl bg-secondary px-8 py-2 text-sm font-bold text-accent transition hover:-translate-y-0.5 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 min-w-[120px]"
          onClick={onNext}
        >
          {isLastStep ? 'Finish' : 'Next Step'}
        </button>
      </div>
    </div>
  )
}

export default TutorialViewer
