import React from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen, waitFor } from '../../../test/render'
import AttendanceSheetMaker from './AttendanceSheetMaker'
import type { AttendanceSheetData } from '../../../types/app'

const mocks = vi.hoisted(() => ({
    createAttendanceSheet: vi.fn(),
    deleteAttendanceSheet: vi.fn(),
    fetchAttendanceSheetTemplateSeed: vi.fn(),
    fetchAttendanceSheetTemplates: vi.fn(),
    fetchAttendanceSheets: vi.fn(),
    previewAttendanceSheetPdf: vi.fn(),
    updateAttendanceSheet: vi.fn(),
}))

vi.mock('../../../lib/attendanceSheetsApi', () => mocks)

const splashSeed: AttendanceSheetData = {
    title: 'Splash 1',
    headerLabel: 'Start Day/Time',
    sheetWidthPx: 1300,
    rotateHeightPx: 300,
    rotateTranslatePx: 190,
    rotateTopPx: 100,
    skillColumnWidthPt: 50,
    nameColumnWidthPt: 630,
    showPreviousLevel: true,
    showResult: true,
    showRegisterIn: true,
    skills: [
        {
            id: 'skill-1',
            label: '1. Enter and Exit Shallow Water',
            details: ['Foot-first entry'],
        },
    ],
}

function renderMaker() {
    return customRender(
        <AttendanceSheetMaker
            teamId="team-1"
            teamName="Deck Team"
            selectedTermLabel="Winter 2026"
        />,
    )
}

describe('AttendanceSheetMaker', () => {
    beforeEach(() => {
        mocks.createAttendanceSheet.mockReset()
        mocks.deleteAttendanceSheet.mockReset()
        mocks.fetchAttendanceSheetTemplateSeed.mockReset()
        mocks.fetchAttendanceSheetTemplates.mockReset()
        mocks.fetchAttendanceSheets.mockReset()
        mocks.previewAttendanceSheetPdf.mockReset()
        mocks.updateAttendanceSheet.mockReset()

        mocks.fetchAttendanceSheetTemplates.mockResolvedValue({ templates: ['Splash1', 'Splash2A'] })
        mocks.fetchAttendanceSheets.mockResolvedValue({ sheets: [] })
        mocks.fetchAttendanceSheetTemplateSeed.mockResolvedValue({
            template: 'Splash1',
            sheetData: splashSeed,
        })
        mocks.createAttendanceSheet.mockResolvedValue({
            sheet: {
                id: 'sheet-1',
                teamId: 'team-1',
                name: 'Splash 1 Custom',
                baseTemplate: 'Splash1',
                defaultForTemplate: null,
                sheetData: splashSeed,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
            },
        })
        mocks.previewAttendanceSheetPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))

        vi.spyOn(window, 'alert').mockImplementation(() => {})
        vi.spyOn(window, 'open').mockReturnValue({} as Window)
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:test'),
            revokeObjectURL: vi.fn(),
        })
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('allows built-in template drafts when saved sheets are unavailable', async () => {
        const user = userEvent.setup()
        mocks.fetchAttendanceSheets.mockRejectedValue(new Error('relation attendance_sheets does not exist'))

        renderMaker()

        expect(await screen.findByRole('option', { name: 'Splash1' })).toBeInTheDocument()
        expect(
            await screen.findByText(/Saved custom sheets are unavailable until the attendance sheet table is set up/i),
        ).toBeInTheDocument()

        await user.selectOptions(screen.getByLabelText(/Create From Built-In/i), 'Splash1')
        await user.click(screen.getByRole('button', { name: 'Use Template' }))

        expect(await screen.findByDisplayValue('Splash 1 Custom')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Splash 1')).toBeInTheDocument()
        expect(screen.getByDisplayValue('1. Enter and Exit Shallow Water')).toBeInTheDocument()
        expect(await screen.findByTitle('Attendance sheet PDF preview')).toBeInTheDocument()
        expect(mocks.createAttendanceSheet).not.toHaveBeenCalled()
    })

    it('only saves a built-in template draft when Save is pressed', async () => {
        const user = userEvent.setup()

        renderMaker()

        await user.selectOptions(await screen.findByLabelText(/Create From Built-In/i), 'Splash1')
        await user.click(screen.getByRole('button', { name: 'Use Template' }))
        await screen.findByDisplayValue('Splash 1 Custom')

        expect(mocks.createAttendanceSheet).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(mocks.createAttendanceSheet).toHaveBeenCalledTimes(1)
        })
        expect(mocks.createAttendanceSheet).toHaveBeenCalledWith(
            expect.objectContaining({
                teamId: 'team-1',
                name: 'Splash 1 Custom',
                baseTemplate: 'Splash1',
                sheetData: expect.objectContaining({ title: 'Splash 1' }),
            }),
        )
    })

    it('previews a built-in template draft without saving it and uses the sample student count', async () => {
        const user = userEvent.setup()

        renderMaker()

        await user.selectOptions(await screen.findByLabelText(/Create From Built-In/i), 'Splash1')
        await user.click(screen.getByRole('button', { name: 'Use Template' }))
        await screen.findByDisplayValue('Splash 1 Custom')

        await waitFor(() => {
            expect(mocks.previewAttendanceSheetPdf).toHaveBeenCalled()
        })
        mocks.previewAttendanceSheetPdf.mockClear()

        const sampleInput = screen.getByLabelText(/Sample Students/i)
        await user.clear(sampleInput)
        await user.type(sampleInput, '12')

        await waitFor(() => {
            expect(mocks.previewAttendanceSheetPdf).toHaveBeenCalled()
        })
        expect(mocks.createAttendanceSheet).not.toHaveBeenCalled()
        expect(mocks.previewAttendanceSheetPdf).toHaveBeenLastCalledWith(
            expect.objectContaining({
                sheet: expect.objectContaining({
                    teamId: 'team-1',
                    name: 'Splash 1 Custom',
                    baseTemplate: 'Splash1',
                }),
                roster: expect.objectContaining({
                    code: 'SAMPLE',
                    location: 'Deck Team',
                    students: expect.arrayContaining([
                        { name: 'Sample Student 1' },
                        { name: 'Sample Student 12' },
                    ]),
                }),
                session: 'Winter 2026',
            }),
            expect.any(AbortSignal),
        )
    })
})
