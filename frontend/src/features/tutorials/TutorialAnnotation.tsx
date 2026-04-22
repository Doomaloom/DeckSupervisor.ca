import React from 'react'
import type { TutorialAnnotation } from './types'
import { TutorialCalloutPin, TutorialHighlightBox } from './scenes/TutorialScenePrimitives'

type TutorialAnnotationProps = {
  annotations: TutorialAnnotation[]
}

export function TutorialAnnotationOverlay({ annotations }: TutorialAnnotationProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {annotations.map((annotation, index) => (
        <React.Fragment key={annotation.id}>
          {annotation.width && annotation.height ? (
            <TutorialHighlightBox
              x={annotation.x}
              y={annotation.y}
              width={annotation.width}
              height={annotation.height}
            />
          ) : null}
          <TutorialCalloutPin index={index + 1} x={annotation.x} y={annotation.y} />
        </React.Fragment>
      ))}
    </div>
  )
}

function TutorialAnnotationList({ annotations }: TutorialAnnotationProps) {
  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-2">
      {annotations.map((annotation, index) => (
        <li
          key={annotation.id}
          className="rounded-2xl border border-secondary/15 bg-bg px-4 py-3 text-sm text-secondary"
        >
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-accent">
            {index + 1}
          </span>
          <span className="font-semibold">{annotation.label}</span>
          <span className="mt-1 block text-secondary/75">{annotation.description}</span>
        </li>
      ))}
    </ol>
  )
}

export default TutorialAnnotationList
