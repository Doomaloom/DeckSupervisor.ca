import type { AttendanceSheet, AttendanceSheetData, SaveAttendanceSheetRequest } from '../types/app'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
        ...options,
    })

    if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Request failed')
    }

    if (response.status === 204) {
        return undefined as T
    }

    return (await response.json()) as T
}

export function fetchAttendanceSheets(teamId: string) {
    return request<{ sheets: AttendanceSheet[] }>(
        `/api/attendance-sheets?teamId=${encodeURIComponent(teamId)}`,
    )
}

export function fetchAttendanceSheetTemplates() {
    return request<{ templates: string[] }>('/api/attendance-sheets/templates')
}

export function fetchAttendanceSheetTemplateSeed(template: string) {
    return request<{ template: string; sheetData: AttendanceSheetData }>(
        `/api/attendance-sheets/templates/${encodeURIComponent(template)}`,
    )
}

export function createAttendanceSheet(input: SaveAttendanceSheetRequest) {
    return request<{ sheet: AttendanceSheet }>('/api/attendance-sheets', {
        method: 'POST',
        body: JSON.stringify(input),
    })
}

export function updateAttendanceSheet(id: string, input: SaveAttendanceSheetRequest) {
    return request<{ sheet: AttendanceSheet }>(`/api/attendance-sheets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    })
}

export function deleteAttendanceSheet(id: string, teamId: string) {
    return request<void>(
        `/api/attendance-sheets/${encodeURIComponent(id)}?teamId=${encodeURIComponent(teamId)}`,
        { method: 'DELETE' },
    )
}

export async function previewAttendanceSheetPdf(input: {
    sheet: SaveAttendanceSheetRequest
    session: string
    title: string
    roster: {
        code: string
        level: string
        serviceName: string
        time: string
        instructor: string
        location: string
        schedule: string
        students: Array<{ name: string }>
    }
}, signal?: AbortSignal) {
    const response = await fetch('/api/attendance-sheets/preview-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal,
    })

    if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to generate attendance sheet preview')
    }

    return response.blob()
}
