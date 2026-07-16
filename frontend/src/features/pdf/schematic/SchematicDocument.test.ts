import { describe, expect, it } from 'vitest'
import { clampSchematicScale } from './SchematicDocument'

describe('schematic scale', () => {
  it('clamps and steps values from 60 to 120 percent', () => {
    expect(clampSchematicScale(42)).toBe(60)
    expect(clampSchematicScale(103)).toBe(105)
    expect(clampSchematicScale(140)).toBe(120)
    expect(clampSchematicScale(undefined)).toBe(100)
  })
})
