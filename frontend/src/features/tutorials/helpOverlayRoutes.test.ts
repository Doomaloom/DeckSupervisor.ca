import { describe, expect, it } from 'vitest'
import { routeToHelpOverlayId } from './helpOverlayRoutes'

describe('helpOverlayRoutes', () => {
  it('maps supported prep pages to help overlays', () => {
    expect(routeToHelpOverlayId('/manage-sessions')).toBe('manage-session')
    expect(routeToHelpOverlayId('/schematic')).toBe('schematic')
    expect(routeToHelpOverlayId('/rosters')).toBe('rosters')
    expect(routeToHelpOverlayId('/print')).toBe('print')
  })

  it('returns null for unsupported routes', () => {
    expect(routeToHelpOverlayId('/')).toBe('dashboard')
    expect(routeToHelpOverlayId('/staff-notes')).toBeNull()
    expect(routeToHelpOverlayId('/unknown')).toBeNull()
  })
})
