import { DocumentArrowDownIcon, ArrowTopRightOnSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { SaveAttendanceSheetRequest } from '../../../types/app'
import SkillEditorList from './SkillEditorList'

type Props = {
    draft: SaveAttendanceSheetRequest
    templates: string[]
    saving: boolean
    deleting: boolean
    canDelete: boolean
    onChange: (draft: SaveAttendanceSheetRequest) => void
    onSave: () => void
    onOpenPreview: () => void
    onDelete: () => void
}

function AttendanceSheetEditor({
    draft,
    templates,
    saving,
    deleting,
    canDelete,
    onChange,
    onSave,
    onOpenPreview,
    onDelete,
}: Props) {
    const sheetData = draft.sheetData
    const updateDraft = (patch: Partial<SaveAttendanceSheetRequest>) => {
        onChange({ ...draft, ...patch })
    }
    const updateSheetData = (patch: Partial<typeof sheetData>) => {
        onChange({ ...draft, sheetData: { ...sheetData, ...patch } })
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-secondary">
                    Sheet Name
                    <input
                        className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={draft.name}
                        onChange={event => updateDraft({ name: event.target.value })}
                    />
                </label>
                <label className="text-sm font-semibold text-secondary">
                    Display Title
                    <input
                        className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={sheetData.title}
                        onChange={event => updateSheetData({ title: event.target.value })}
                    />
                </label>
                <label className="text-sm font-semibold text-secondary">
                    Base Template
                    <input
                        className="mt-1 w-full rounded-2xl border-2 border-secondary/20 bg-bg px-3 py-2 text-sm text-secondary/70"
                        value={draft.baseTemplate ?? 'Blank'}
                        readOnly
                    />
                </label>
                <label className="text-sm font-semibold text-secondary">
                    Use as Team Default For
                    <select
                        className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={draft.defaultForTemplate ?? ''}
                        onChange={event => updateDraft({ defaultForTemplate: event.target.value || null })}
                    >
                        <option value="">No default override</option>
                        {templates.map(template => (
                            <option key={template} value={template}>
                                {template}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="flex flex-row flex-wrap items-center gap-1">
                    <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                        <input
                            type="checkbox"
                            checked={sheetData.showPreviousLevel}
                            onChange={event => updateSheetData({ showPreviousLevel: event.target.checked })}
                        />
                        Previous Level
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                        <input
                            type="checkbox"
                            checked={sheetData.showResult}
                            onChange={event => updateSheetData({ showResult: event.target.checked })}
                        />
                        Result
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                        <input
                            type="checkbox"
                            checked={sheetData.showRegisterIn}
                            onChange={event => updateSheetData({ showRegisterIn: event.target.checked })}
                        />
                        Register In
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                    ['Sheet Width', 'sheetWidthPx'],
                    ['Rotate Height', 'rotateHeightPx'],
                    ['Rotate Offset', 'rotateTranslatePx'],
                    ['Rotate Top', 'rotateTopPx'],
                    ['Skill Width', 'skillColumnWidthPt'],
                ].map(([label, key]) => (
                    <label key={key} className="text-sm font-semibold text-secondary">
                        {label}
                        <input
                            className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                            type="number"
                            min="1"
                            value={Number(sheetData[key as keyof typeof sheetData])}
                            onChange={event =>
                                updateSheetData({ [key]: Number.parseInt(event.target.value, 10) || 1 })
                            }
                        />
                    </label>
                ))}
            </div>

            <SkillEditorList
                skills={sheetData.skills}
                onChange={skills => updateSheetData({ skills })}
            />

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:opacity-60"
                    disabled={saving}
                    onClick={onSave}
                >
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-secondary/40 bg-bg px-5 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
                    onClick={onOpenPreview}
                >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Open PDF
                </button>
                {canDelete && (
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-bg px-5 py-2 text-sm font-semibold text-red-700 transition hover:-translate-y-0.5 hover:bg-red-50 disabled:opacity-60"
                        disabled={deleting}
                        onClick={onDelete}
                    >
                        <TrashIcon className="h-4 w-4" />
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                )}
            </div>
        </div>
    )
}

export default AttendanceSheetEditor
