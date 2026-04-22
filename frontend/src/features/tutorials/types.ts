export type TutorialId =
  | 'prep-workflow'
  | 'dashboard'
  | 'upload-csv'
  | 'start-session'
  | 'manage-session'
  | 'schematic'
  | 'rosters'
  | 'custom-rosters'
  | 'print'
  | 'report-cards'
  | 'notes'
  | 'share-sessions'
  | 'team'
  | 'account'

export type TutorialAnnotation = {
  id: string
  label: string
  description: string
  x: number
  y: number
  width?: number
  height?: number
}

type TutorialBaseStep = {
  title: string
}

export type TutorialStep =
  | ({ kind: 'intro'; body: string[] } & TutorialBaseStep)
  | ({ kind: 'checklist'; items: string[] } & TutorialBaseStep)
  | ({
      kind: 'scene'
      body?: string[]
      sceneId: string
      annotations: TutorialAnnotation[]
    } & TutorialBaseStep)
  | ({
      kind: 'image'
      body?: string[]
      src: string
      alt: string
      annotations?: TutorialAnnotation[]
    } & TutorialBaseStep)
  | ({ kind: 'tips'; items: string[] } & TutorialBaseStep)
  | ({ kind: 'warning'; items: string[] } & TutorialBaseStep)
  | ({ kind: 'related'; tutorialIds: TutorialId[] } & TutorialBaseStep)

export type TutorialDefinition = {
  id: TutorialId
  title: string
  shortDescription: string
  audience: 'part-time'
  visibleInCatalog?: boolean
  routePaths?: string[]
  keywords: string[]
  prerequisites?: string[]
  steps: TutorialStep[]
}

export type TutorialCatalogMode = 'current-page' | 'catalog'
