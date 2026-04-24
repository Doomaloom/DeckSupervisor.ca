import { tutorialRegistry } from './tutorialRegistry'
import TutorialScene from './TutorialScene'
import type { TutorialStep } from './types'

type TutorialStepRendererProps = {
  step: TutorialStep
  onOpenTutorial: (tutorialId: keyof typeof tutorialRegistry) => void
}

function TutorialStepRenderer({ step, onOpenTutorial }: TutorialStepRendererProps) {
  switch (step.kind) {
    case 'intro':
      return null // Handled by TutorialViewer
    case 'checklist':
      return (
        <ul className="grid gap-3 p-4">
          {step.items.map(item => (
            <li
              key={item}
              className="rounded-2xl border border-secondary/15 bg-accent px-4 py-3 text-sm text-secondary"
            >
              {item}
            </li>
          ))}
        </ul>
      )
    case 'scene':
      return <TutorialScene sceneId={step.sceneId} annotations={step.annotations} />
    case 'image':
      return (
        <img
          src={step.src}
          alt={step.alt}
          className="w-full rounded-[2rem] border border-secondary/15 bg-white object-cover shadow-sm"
        />
      )
    case 'tips':
      return (
        <div className="rounded-card border border-primary/20 bg-primary/10 p-5 m-4">
          <ul className="grid gap-3">
            {step.items.map(item => (
              <li key={item} className="text-sm leading-6 text-secondary font-medium">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'warning':
      return (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-5 m-4">
          <ul className="grid gap-3">
            {step.items.map(item => (
              <li key={item} className="text-sm leading-6 text-secondary font-medium text-danger">
                ⚠️ {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'related':
      return (
        <div className="grid gap-3 sm:grid-cols-2 p-4">
          {step.tutorialIds.map(tutorialId => {
            const tutorial = tutorialRegistry[tutorialId]
            return (
              <button
                key={tutorialId}
                type="button"
                className="rounded-2xl border border-secondary/15 bg-accent p-4 text-left transition hover:-translate-y-0.5 hover:border-secondary shadow-sm"
                onClick={() => onOpenTutorial(tutorialId)}
              >
                <p className="text-sm font-semibold text-secondary">{tutorial.title}</p>
                <p className="mt-1 text-xs text-secondary/60 leading-relaxed">{tutorial.shortDescription}</p>
              </button>
            )
          })}
        </div>
      )
    default:
      return null
  }
}

export default TutorialStepRenderer
