import { describe, expect, it } from 'vitest'
import { getRecommendedTutorialIds, routeToTutorialId } from './tutorialRoutes'

describe('tutorialRoutes', () => {
  it('maps covered part-time routes to tutorials', () => {
    expect(routeToTutorialId('/')).toBe('dashboard')
    expect(routeToTutorialId('/manage-sessions')).toBe('manage-session')
    expect(routeToTutorialId('/schematic')).toBe('schematic')
    expect(routeToTutorialId('/rosters')).toBe('rosters')
    expect(routeToTutorialId('/print')).toBe('print')
    expect(routeToTutorialId('/report-cards')).toBe('report-cards')
    expect(routeToTutorialId('/staff-notes')).toBe('notes')
    expect(routeToTutorialId('/share-sessions')).toBe('share-sessions')
    expect(routeToTutorialId('/team')).toBe('team')
    expect(routeToTutorialId('/account')).toBe('account')
  })

  it('returns null for unmatched routes and falls back to recommendations', () => {
    expect(routeToTutorialId('/session-planning')).toBeNull()
    expect(getRecommendedTutorialIds('/session-planning')).toEqual([
      'prep-workflow',
      'share-sessions',
      'notes',
    ])
    expect(getRecommendedTutorialIds('/unknown')).toEqual(['prep-workflow', 'dashboard', 'print'])
  })
})
