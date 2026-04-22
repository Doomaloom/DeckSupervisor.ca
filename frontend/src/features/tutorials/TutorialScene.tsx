import TutorialAnnotationList, { TutorialAnnotationOverlay } from './TutorialAnnotation'
import { getTutorialSceneDefinition } from './scenes/sceneRegistry'
import type { TutorialAnnotation } from './types'

type TutorialSceneProps = {
  sceneId: string
  annotations: TutorialAnnotation[]
}

function TutorialScene({ sceneId, annotations }: TutorialSceneProps) {
  const scene = getTutorialSceneDefinition(sceneId)

  if (!scene) {
    return (
      <div className="rounded-card border border-danger/30 bg-accent p-4 text-sm font-semibold text-danger">
        Missing tutorial scene: {sceneId}
      </div>
    )
  }

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-[2rem] border border-secondary/15 bg-[#f7f4ed] p-4"
        role="img"
        aria-label={scene.ariaLabel}
      >
        {scene.render()}
        {annotations.length > 0 ? <TutorialAnnotationOverlay annotations={annotations} /> : null}
      </div>
      {annotations.length > 0 ? <TutorialAnnotationList annotations={annotations} /> : null}
    </div>
  )
}

export default TutorialScene
