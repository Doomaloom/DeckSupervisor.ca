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
      return (
        <div className="space-y-3">
          {step.body.map(paragraph => (
            <p key={paragraph} className="text-sm leading-6 text-secondary/85">
              {paragraph}
            </p>
          ))}
        </div>
      )
    case 'checklist':
      return (
        <ul className="grid gap-3">
          {step.items.map(item => (
            <li
              key={item}
              className="rounded-2xl border border-secondary/15 bg-bg px-4 py-3 text-sm text-secondary"
            >
              {item}
            </li>
          ))}
        </ul>
      )
    case 'scene':
      return (
        <div className="space-y-4">
          {step.body?.map(paragraph => (
            <p key={paragraph} className="text-sm leading-6 text-secondary/85">
              {paragraph}
            </p>
          ))}
          <TutorialScene sceneId={step.sceneId} annotations={step.annotations} />
        </div>
      )
    case 'image':
      return (
        <div className="space-y-4">
          {step.body?.map(paragraph => (
            <p key={paragraph} className="text-sm leading-6 text-secondary/85">
              {paragraph}
            </p>
          ))}
          <img
            src={step.src}
            alt={step.alt}
            className="w-full rounded-[2rem] border border-secondary/15 bg-white object-cover shadow-sm"
          />
        </div>
      )
    case 'tips':
      return (
        <div className="rounded-card border border-primary/20 bg-primary/10 p-5">
          <ul className="grid gap-3">
            {step.items.map(item => (
              <li key={item} className="text-sm leading-6 text-secondary">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'warning':
      return (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-5">
          <ul className="grid gap-3">
            {step.items.map(item => (
              <li key={item} className="text-sm leading-6 text-secondary">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'related':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {step.tutorialIds.map(tutorialId => {
            const tutorial = tutorialRegistry[tutorialId]
            return (
              <button
                key={tutorialId}
                type="button"
                className="rounded-2xl border border-secondary/15 bg-bg p-4 text-left transition hover:-translate-y-0.5 hover:border-secondary"
                onClick={() => onOpenTutorial(tutorialId)}
              >
                <p className="text-sm font-semibold text-secondary">{tutorial.title}</p>
                <p className="mt-1 text-sm text-secondary/70">{tutorial.shortDescription}</p>
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
