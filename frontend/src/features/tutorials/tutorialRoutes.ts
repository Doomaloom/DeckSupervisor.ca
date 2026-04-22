import type { TutorialId } from './types'

const routeTutorialMap: Record<string, TutorialId> = {
  '/': 'dashboard',
  '/manage-sessions': 'manage-session',
  '/schematic': 'schematic',
  '/rosters': 'rosters',
  '/print': 'print',
  '/report-cards': 'report-cards',
  '/staff-notes': 'notes',
  '/share-sessions': 'share-sessions',
  '/team': 'team',
  '/account': 'account',
}

const routeRecommendations: Array<{ pattern: RegExp; tutorialIds: TutorialId[] }> = [
  { pattern: /^\/requests/, tutorialIds: ['prep-workflow', 'share-sessions', 'team'] },
  { pattern: /^\/full-timer-tools/, tutorialIds: ['prep-workflow', 'print', 'notes'] },
  { pattern: /^\/session-planning/, tutorialIds: ['prep-workflow', 'share-sessions', 'notes'] },
]

const defaultRecommendations: TutorialId[] = ['prep-workflow', 'dashboard', 'print']

export function routeToTutorialId(pathname: string): TutorialId | null {
  return routeTutorialMap[pathname] ?? null
}

export function getRecommendedTutorialIds(pathname: string): TutorialId[] {
  const routeTutorial = routeToTutorialId(pathname)
  if (routeTutorial) {
    return [routeTutorial]
  }

  const match = routeRecommendations.find(entry => entry.pattern.test(pathname))
  if (match) {
    return match.tutorialIds
  }

  return defaultRecommendations
}
