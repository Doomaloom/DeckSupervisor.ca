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
  onSetStep,
  onNext,
  onPrevious,
}: TutorialViewerProps) {
  const tutorial = tutorialRegistry[tutorialId]
  const step = tutorial.steps[activeStepIndex]
  const isFirstStep = activeStepIndex === 0
  const isLastStep = activeStepIndex === tutorial.steps.length - 1

  return (
    <div className="grid gap-6 xl:grid-cols-[17rem,1fr]">
      <aside className="space-y-4">
        {tutorial.prerequisites?.length ? (
          <div className="rounded-card border border-secondary/15 bg-bg p-4">
            <p className="text-sm font-semibold text-secondary">Before you start</p>
            <ul className="mt-2 grid gap-2">
              {tutorial.prerequisites.map(item => (
                <li key={item} className="text-sm text-secondary/75">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2">
          {tutorial.steps.map((item, index) => {
            const isActive = index === activeStepIndex
            return (
              <button
                key={`${tutorial.id}-step-${index + 1}`}
                type="button"
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-secondary bg-secondary text-accent'
                    : 'border-secondary/15 bg-bg text-secondary hover:border-secondary'
                }`}
                onClick={() => onSetStep(index)}
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive ? 'bg-accent text-secondary' : 'bg-secondary/10 text-secondary'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className={`mt-1 block text-xs ${isActive ? 'text-accent/80' : 'text-secondary/60'}`}>
                    {item.kind.replace('-', ' ')}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="space-y-6">
        <div
          className="rounded-card border border-secondary/15 bg-accent p-6 shadow-sm"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/60">
            Step {activeStepIndex + 1} of {tutorial.steps.length}
          </p>
          <h4 className="mt-2 text-2xl font-semibold text-secondary">{step.title}</h4>
          <div className="mt-5">
            <TutorialStepRenderer step={step} onOpenTutorial={onOpenTutorial} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-2xl border border-secondary/20 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onPrevious}
            disabled={isFirstStep}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onNext}
            disabled={isLastStep}
          >
            {isLastStep ? 'End of Tutorial' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default TutorialViewer
