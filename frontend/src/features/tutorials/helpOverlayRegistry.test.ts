import { describe, expect, it } from 'vitest'
import { helpOverlayRegistry } from './helpOverlayRegistry'
import { resolveHelpOverlayTips } from './hooks/useHelpOverlayLayout'

describe('helpOverlayRegistry', () => {
  it('includes overlays for all supported prep pages', () => {
    expect(helpOverlayRegistry['manage-session']).toBeDefined()
    expect(helpOverlayRegistry.schematic).toBeDefined()
    expect(helpOverlayRegistry.rosters).toBeDefined()
    expect(helpOverlayRegistry.print).toBeDefined()
  })

  it('keeps tip selectors unique within each overlay', () => {
    Object.values(helpOverlayRegistry).forEach(overlay => {
      const selectors = overlay.tips.map(tip => tip.selector)
      expect(new Set(selectors).size).toBe(selectors.length)
    })
  })

  it('filters missing selectors and resolves visible anchors', () => {
    document.body.innerHTML = `
      <div data-help-anchor="print-page-header" style="width: 300px; height: 120px;"></div>
      <div data-help-anchor="print-day1" style="width: 200px; height: 120px;"></div>
    `

    const resolved = resolveHelpOverlayTips(helpOverlayRegistry.print)

    expect(resolved.map(tip => tip.id)).toEqual(['overview', 'day1'])
  })

  it('returns no resolved tips when every anchor is missing', () => {
    document.body.innerHTML = ''

    expect(resolveHelpOverlayTips(helpOverlayRegistry.schematic)).toEqual([])
  })
})
