import type {
    AttendanceSheet,
    AttendanceSheetData,
    AttendanceSheetSkill,
    SaveAttendanceSheetRequest,
} from '../../../types/app'

export const defaultAttendanceSheetData: AttendanceSheetData = {
    baseTemplate: '',
    title: 'Custom Attendance',
    headerLabel: 'Day/Time',
    sheetWidthPx: 1300,
    rotateHeightPx: 300,
    rotateTranslatePx: 190,
    rotateTopPx: 100,
    skillColumnWidthPt: 50,
    nameColumnWidthPt: 630,
    showPreviousLevel: true,
    showResult: true,
    showRegisterIn: true,
    skills: [],
}

export function createSkill(label = ''): AttendanceSheetSkill {
    return {
        id: `skill-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        details: [],
    }
}

export function createBlankSheetDraft(teamId: string): SaveAttendanceSheetRequest {
    return {
        teamId,
        name: 'New Attendance Sheet',
        baseTemplate: null,
        defaultForTemplate: null,
        sheetData: {
            ...defaultAttendanceSheetData,
            skills: [],
        },
    }
}

export function createSheetDraftFromSeed(
    teamId: string,
    template: string,
    sheetData: AttendanceSheetData,
): SaveAttendanceSheetRequest {
    const title = sheetData.title?.trim() || template
    return {
        teamId,
        name: `${title} Custom`,
        baseTemplate: template,
        defaultForTemplate: null,
        sheetData: normalizeAttendanceSheetData({ ...sheetData, title }),
    }
}

export function draftFromSheet(sheet: AttendanceSheet): SaveAttendanceSheetRequest {
    return {
        teamId: sheet.teamId,
        name: sheet.name,
        baseTemplate: sheet.baseTemplate,
        defaultForTemplate: sheet.defaultForTemplate,
        sheetData: normalizeAttendanceSheetData(sheet.sheetData),
    }
}

export function normalizeAttendanceSheetData(data: Partial<AttendanceSheetData>): AttendanceSheetData {
    return {
        ...defaultAttendanceSheetData,
        ...data,
        title: data.title?.trim() || defaultAttendanceSheetData.title,
        headerLabel: data.headerLabel?.trim() || defaultAttendanceSheetData.headerLabel,
        skills: (data.skills ?? [])
            .map(skill => ({
                id: skill.id || createSkill().id,
                label: skill.label.trim(),
                details: skill.details.map(detail => detail.trim()).filter(Boolean),
            }))
            .filter(skill => skill.label),
    }
}

export function buildSavePayload(draft: SaveAttendanceSheetRequest): SaveAttendanceSheetRequest {
    const name = draft.name.trim() || 'New Attendance Sheet'
    return {
        teamId: draft.teamId,
        name,
        baseTemplate: cleanOptional(draft.baseTemplate),
        defaultForTemplate: cleanOptional(draft.defaultForTemplate),
        sheetData: normalizeAttendanceSheetData({
            ...draft.sheetData,
            baseTemplate: cleanOptional(draft.baseTemplate) ?? '',
            title: draft.sheetData.title?.trim() || name,
        }),
    }
}

export function moveSkill(
    skills: AttendanceSheetSkill[],
    index: number,
    direction: -1 | 1,
): AttendanceSheetSkill[] {
    const nextIndex = index + direction
    if (index < 0 || index >= skills.length || nextIndex < 0 || nextIndex >= skills.length) {
        return skills
    }
    const next = [...skills]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item)
    return next
}

export function resolveDefaultSheet(
    sheets: AttendanceSheet[],
    template: string,
): AttendanceSheet | null {
    return sheets.find(sheet => sheet.defaultForTemplate === template) ?? null
}

function cleanOptional(value?: string | null) {
    const trimmed = value?.trim() ?? ''
    return trimmed || null
}
