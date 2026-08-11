import { describe, expect, it } from 'vitest'
import {
  LEGACY_ATTENDANCE_TEMPLATE_KEYS,
  loadAttendanceTemplate,
  normalizeAttendanceTemplateKey,
} from './templateRegistry'

describe('historical attendance template registry', () => {
  it('loads exactly 23 independently editable templates', async () => {
    expect(LEGACY_ATTENDANCE_TEMPLATE_KEYS).toHaveLength(23)
    const loaded = await Promise.all(LEGACY_ATTENDANCE_TEMPLATE_KEYS.map(loadAttendanceTemplate))
    expect(new Set(loaded.map(template => template.key)).size).toBe(23)
    loaded.forEach(template => {
      expect(template.html).toContain('id="attendance-rows"')
      expect(template.html).toContain('id="student-rows"')
      expect(template.html).toMatch(/page-break-before:\s*always|break-before-page/)
    })
  })

  it('normalizes legacy names and falls back to Splash Fitness', () => {
    expect(normalizeAttendanceTemplateKey('Splash 2A')).toBe('Splash2A')
    expect(normalizeAttendanceTemplateKey('TeenAdult3.html')).toBe('TeenAdult3')
    expect(normalizeAttendanceTemplateKey('unknown')).toBe('SplashFitness')
  })
})
