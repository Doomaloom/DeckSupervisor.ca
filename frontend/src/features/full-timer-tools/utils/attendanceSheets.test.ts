import { describe, expect, it, vi } from 'vitest'
import type { AttendanceSheet } from '../../../types/app'
import {
    buildSavePayload,
    createBlankSheetDraft,
    moveSkill,
    normalizeAttendanceSheetData,
    resolveDefaultSheet,
} from './attendanceSheets'

describe('attendance sheet utilities', () => {
    it('normalizes sheet data and removes empty skills/details', () => {
        const data = normalizeAttendanceSheetData({
            title: '  ',
            headerLabel: ' Start Day/Time ',
            skills: [
                { id: 'one', label: ' 1. Float ', details: [' body line ', ''] },
                { id: 'two', label: ' ', details: ['ignored'] },
            ],
        })

        expect(data.title).toBe('Custom Attendance')
        expect(data.headerLabel).toBe('Start Day/Time')
        expect(data.skills).toEqual([{ id: 'one', label: '1. Float', details: ['body line'] }])
    })

    it('builds a save payload with cleaned optional template fields', () => {
        const draft = createBlankSheetDraft('team-1')
        draft.name = '  My Sheet '
        draft.baseTemplate = ' Splash1 '
        draft.defaultForTemplate = ' '
        draft.sheetData.title = ''

        const payload = buildSavePayload(draft)

        expect(payload.name).toBe('My Sheet')
        expect(payload.baseTemplate).toBe('Splash1')
        expect(payload.defaultForTemplate).toBeNull()
        expect(payload.sheetData.title).toBe('My Sheet')
    })

    it('moves skills when the target index is valid', () => {
        const skills = [
            { id: 'a', label: 'A', details: [] },
            { id: 'b', label: 'B', details: [] },
            { id: 'c', label: 'C', details: [] },
        ]

        expect(moveSkill(skills, 1, -1).map(skill => skill.id)).toEqual(['b', 'a', 'c'])
        expect(moveSkill(skills, 0, -1)).toBe(skills)
    })

    it('resolves a team default sheet by built-in template name', () => {
        const sheets = [
            { id: '1', defaultForTemplate: null },
            { id: '2', defaultForTemplate: 'Splash1' },
        ] as AttendanceSheet[]

        expect(resolveDefaultSheet(sheets, 'Splash1')?.id).toBe('2')
        expect(resolveDefaultSheet(sheets, 'Splash2A')).toBeNull()
    })

    it('creates generated ids for normalized skills without ids', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5)
        const data = normalizeAttendanceSheetData({
            skills: [{ id: '', label: 'Skill', details: [] }],
        })
        expect(data.skills[0].id).toContain('skill-')
    })
})
