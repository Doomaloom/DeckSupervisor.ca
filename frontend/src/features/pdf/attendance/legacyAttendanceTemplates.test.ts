import { describe, expect, it } from 'vitest'
import {
  LEGACY_ATTENDANCE_TEMPLATE_KEYS,
  loadLegacyAttendanceTemplate,
  normalizeAttendanceTemplateKey,
} from './legacyAttendanceTemplates'

describe('historical attendance templates', () => {
  it('loads all 23 independently editable templates', async () => {
    expect(LEGACY_ATTENDANCE_TEMPLATE_KEYS).toHaveLength(23)
    const templates = await Promise.all(LEGACY_ATTENDANCE_TEMPLATE_KEYS.map(loadLegacyAttendanceTemplate))
    templates.forEach(({ html }) => {
      expect(html).toContain('id="attendance-rows"')
      expect(html).toContain('id="student-rows"')
      expect(html).toContain('break-before-page')
      for (const id of ['instructor', 'start_time', 'session', 'location', 'barcode']) {
        expect(html).toContain(`id="${id}"`)
      }
    })
  })

  it('normalizes spaces and falls back to Splash Fitness', () => {
    expect(normalizeAttendanceTemplateKey('Splash 2A')).toBe('Splash2A')
    expect(normalizeAttendanceTemplateKey('missing')).toBe('SplashFitness')
  })
})
