import { describe, expect, it } from 'vitest'
import {
  buildSchematicMatrix,
  clampSchematicScale,
  effectiveSchematicScale,
  schematicCapacityColor,
  schematicRowHeight,
} from './schematicModel'

describe('schematic scale', () => {
  it('clamps and steps values from 60 to 120 percent', () => {
    expect(clampSchematicScale(42)).toBe(60)
    expect(clampSchematicScale(103)).toBe(105)
    expect(clampSchematicScale(140)).toBe(120)
    expect(clampSchematicScale(undefined)).toBe(100)
  })

  it('ports historical row heights, capacity placement, and colors', () => {
    expect(schematicRowHeight(30)).toBe(4)
    expect(schematicRowHeight(45)).toBe(6)
    expect(schematicRowHeight(60)).toBe(8)
    expect(schematicCapacityColor({ studentCount: 3, capacity: 10 })).toBe('#FF0000')
    expect(schematicCapacityColor({ studentCount: 6, capacity: 10 })).toBe('#FFC000')
    expect(schematicCapacityColor({ studentCount: 7, capacity: 10 })).toBe('#00B050')
    const model = buildSchematicMatrix({
      instructors: ['Alex'],
      columns: [[{ code: '100', level: 'Splash 7', startMinutes: 540, durationMinutes: 30, studentCount: 7, capacity: 10 }]],
    })
    expect(model?.totalRows).toBe(4)
    expect(model?.matrix.map(row => row[0].text)).toEqual(['', 'Splash 7', '100', '7 of 10'])
    expect(model?.matrix[3][0].color).toBe('#00B050')
  })

  it('combines automatic fit with user scale', () => {
    expect(effectiveSchematicScale('portrait', 8, 100)).toBe(1)
    expect(effectiveSchematicScale('landscape', 80, 60)).toBeLessThan(0.6)
  })
})
