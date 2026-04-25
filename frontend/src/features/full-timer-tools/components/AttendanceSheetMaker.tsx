import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    createAttendanceSheet,
    deleteAttendanceSheet,
    fetchAttendanceSheetTemplateSeed,
    fetchAttendanceSheetTemplates,
    fetchAttendanceSheets,
    previewAttendanceSheetPdf,
    updateAttendanceSheet,
} from '../../../lib/attendanceSheetsApi'
import type { AttendanceSheet, SaveAttendanceSheetRequest } from '../../../types/app'
import AttendanceSheetEditor from './AttendanceSheetEditor'
import AttendanceSheetList from './AttendanceSheetList'
import {
    buildSavePayload,
    createBlankSheetDraft,
    createSheetDraftFromSeed,
    draftFromSheet,
} from '../utils/attendanceSheets'

type Props = {
    teamId: string
    teamName: string
    selectedTermLabel?: string
}

function openPdf(blob: Blob, title: string) {
    const url = window.URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
        const link = document.createElement('a')
        link.href = url
        link.download = `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'attendance-sheet'}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
    }
    window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000)
}

function clampSampleCount(value: number) {
    if (!Number.isFinite(value)) {
        return 0
    }
    return Math.min(30, Math.max(0, Math.trunc(value)))
}

function AttendanceSheetMaker({ teamId, teamName, selectedTermLabel }: Props) {
    const [sheets, setSheets] = useState<AttendanceSheet[]>([])
    const [templates, setTemplates] = useState<string[]>([])
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
    const [draft, setDraft] = useState<SaveAttendanceSheetRequest | null>(null)
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [savedSheetsLoading, setSavedSheetsLoading] = useState(false)
    const [savedSheetsUnavailable, setSavedSheetsUnavailable] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [templateToSeed, setTemplateToSeed] = useState('')
    const [sampleStudentCount, setSampleStudentCount] = useState(8)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)

    const selectedSheet = useMemo(
        () => sheets.find(sheet => sheet.id === selectedSheetId) ?? null,
        [selectedSheetId, sheets],
    )

    const loadTemplates = async () => {
        setTemplatesLoading(true)
        try {
            const templateResponse = await fetchAttendanceSheetTemplates()
            setTemplates(templateResponse.templates)
        } catch (error) {
            console.error(error)
            alert('Unable to load built-in attendance templates.')
        } finally {
            setTemplatesLoading(false)
        }
    }

    const loadSavedSheets = async () => {
        if (!teamId) {
            setSheets([])
            setSavedSheetsUnavailable(false)
            return
        }
        setSavedSheetsLoading(true)
        setSavedSheetsUnavailable(false)
        try {
            const sheetResponse = await fetchAttendanceSheets(teamId)
            setSheets(sheetResponse.sheets)
        } catch (error) {
            console.error(error)
            setSheets([])
            setSavedSheetsUnavailable(true)
        } finally {
            setSavedSheetsLoading(false)
        }
    }

    useEffect(() => {
        setDraft(null)
        setSelectedSheetId(null)
        setTemplateToSeed('')
        void loadTemplates()
        void loadSavedSheets()
    }, [teamId])

    const handleNewBlank = () => {
        setSelectedSheetId(null)
        setDraft(createBlankSheetDraft(teamId))
    }

    const handleSeedTemplate = async () => {
        if (!templateToSeed) {
            return
        }
        try {
            const seed = await fetchAttendanceSheetTemplateSeed(templateToSeed)
            setSelectedSheetId(null)
            setDraft(createSheetDraftFromSeed(teamId, seed.template, seed.sheetData))
        } catch (error) {
            console.error(error)
            alert('Unable to create a sheet from that template.')
        }
    }

    const handleSelectSheet = (sheet: AttendanceSheet) => {
        setSelectedSheetId(sheet.id)
        setDraft(draftFromSheet(sheet))
    }

    const buildPreviewPayload = useCallback((targetDraft: SaveAttendanceSheetRequest) => {
        const payload = buildSavePayload(targetDraft)
        return {
            sheet: payload,
            session: selectedTermLabel || 'Session',
            title: `Attendance - ${payload.name}`,
            roster: {
                code: 'SAMPLE',
                level: payload.sheetData.title,
                serviceName: payload.sheetData.title,
                time: '9:00 AM - 9:30 AM',
                instructor: 'Sample Instructor',
                location: teamName,
                schedule: '',
                students: Array.from({ length: clampSampleCount(sampleStudentCount) }, (_, index) => ({
                    name: `Sample Student ${index + 1}`,
                })),
            },
        }
    }, [sampleStudentCount, selectedTermLabel, teamName])

    const generatePreview = useCallback(async (targetDraft: SaveAttendanceSheetRequest, signal?: AbortSignal) => {
        const blob = await previewAttendanceSheetPdf(buildPreviewPayload(targetDraft), signal)
        return blob
    }, [buildPreviewPayload])

    useEffect(() => {
        setPreviewUrl(current => {
            if (current) {
                window.URL.revokeObjectURL(current)
            }
            return null
        })
        setPreviewError(null)
        if (!draft) {
            setIsPreviewLoading(false)
            return
        }

        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => {
            setIsPreviewLoading(true)
            setPreviewError(null)
            generatePreview(draft, controller.signal)
                .then(blob => {
                    const objectUrl = window.URL.createObjectURL(blob)
                    if (controller.signal.aborted) {
                        window.URL.revokeObjectURL(objectUrl)
                        return
                    }
                    setPreviewUrl(current => {
                        if (current) {
                            window.URL.revokeObjectURL(current)
                        }
                        return objectUrl
                    })
                })
                .catch(error => {
                    if (controller.signal.aborted) {
                        return
                    }
                    console.error(error)
                    setPreviewError(error instanceof Error ? error.message : 'Unable to load attendance sheet preview.')
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setIsPreviewLoading(false)
                    }
                })
        }, 300)

        return () => {
            controller.abort()
            window.clearTimeout(timeoutId)
        }
    }, [draft, generatePreview])

    useEffect(() => {
        return () => {
            setPreviewUrl(current => {
                if (current) {
                    window.URL.revokeObjectURL(current)
                }
                return null
            })
        }
    }, [])

    const handleSave = async () => {
        if (!draft) {
            return
        }
        setSaving(true)
        try {
            const payload = buildSavePayload(draft)
            const response = selectedSheet
                ? await updateAttendanceSheet(selectedSheet.id, payload)
                : await createAttendanceSheet(payload)
            await loadSavedSheets()
            setSelectedSheetId(response.sheet.id)
            setDraft(draftFromSheet(response.sheet))
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : 'Unable to save attendance sheet.')
        } finally {
            setSaving(false)
        }
    }

    const handleOpenPreview = async () => {
        if (!draft) {
            return
        }
        try {
            const payload = buildSavePayload(draft)
            const blob = await generatePreview(draft)
            openPdf(blob, payload.name)
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : 'Unable to open attendance sheet preview.')
        }
    }

    const handleDelete = async () => {
        if (!selectedSheet) {
            return
        }
        setDeleting(true)
        try {
            await deleteAttendanceSheet(selectedSheet.id, teamId)
            setSelectedSheetId(null)
            setDraft(null)
            await loadSavedSheets()
        } catch (error) {
            console.error(error)
            alert('Unable to delete attendance sheet.')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <div className="flex flex-col gap-5">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Tool 2
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">Attendance Sheet Maker</h3>
                    <p className="mt-2 text-sm text-secondary/80">
                        Build reusable team attendance sheets, edit skill columns, and preview the PDF.
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        type="button"
                        className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                        onClick={handleNewBlank}
                    >
                        New Blank Sheet
                    </button>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-secondary">
                            Create From Built-In
                            <select
                                className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                value={templateToSeed}
                                onChange={event => setTemplateToSeed(event.target.value)}
                                disabled={templatesLoading}
                            >
                                <option value="">{templatesLoading ? 'Loading templates...' : 'Select template'}</option>
                                {templates.map(template => (
                                    <option key={template} value={template}>
                                        {template}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            className="rounded-2xl border border-secondary/40 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent disabled:opacity-50"
                            disabled={!templateToSeed || templatesLoading}
                            onClick={handleSeedTemplate}
                        >
                            Use Template
                        </button>
                    </div>
                    {savedSheetsUnavailable && (
                        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Saved custom sheets are unavailable until the attendance sheet table is set up.
                            You can still create from built-in templates and preview PDFs.
                        </p>
                    )}
                    <AttendanceSheetList
                        sheets={sheets}
                        selectedSheetId={selectedSheetId}
                        loading={savedSheetsLoading}
                        onSelect={handleSelectSheet}
                    />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

                    <div className="min-w-0 rounded-2xl border border-secondary/20 bg-accent/70 p-4">
                        {draft ? (
                            <AttendanceSheetEditor
                                draft={draft}
                                templates={templates}
                                saving={saving}
                                deleting={deleting}
                                canDelete={Boolean(selectedSheet)}
                                onChange={setDraft}
                                onSave={handleSave}
                                onOpenPreview={handleOpenPreview}
                                onDelete={handleDelete}
                            />
                        ) : (
                            <p className="text-sm text-secondary/70">
                                Choose an existing sheet, create a blank sheet, or seed one from a built-in template.
                            </p>
                        )}
                    </div>
                    <section className="flex min-h-[34rem] min-w-0 flex-col rounded-2xl border-2 border-secondary p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
                            <div>
                                <h4 className="text-sm font-semibold">PDF Preview</h4>
                                <p className="text-xs text-secondary/70">
                                    Updates automatically from the current draft.
                                </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                                Sample Students
                                <input
                                    className="w-20 rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={sampleStudentCount}
                                    onChange={event => setSampleStudentCount(clampSampleCount(Number.parseInt(event.target.value, 10)))}
                                />
                            </label>
                            {isPreviewLoading ? (
                                <span className="text-xs font-semibold text-secondary/70">Refreshing...</span>
                            ) : null}
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-secondary/20 bg-bg">
                            {previewError ? (
                                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                                    {previewError}
                                </div>
                            ) : previewUrl ? (
                                <iframe
                                    title="Attendance sheet PDF preview"
                                    className="h-full w-full bg-white"
                                    src={previewUrl}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                                    {isPreviewLoading
                                        ? 'Loading preview...'
                                        : 'Create or select an attendance sheet to preview the PDF.'}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

export default AttendanceSheetMaker
