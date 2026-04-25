import type { AttendanceSheet } from '../../../types/app'

type Props = {
    sheets: AttendanceSheet[]
    selectedSheetId: string | null
    loading: boolean
    onSelect: (sheet: AttendanceSheet) => void
}

function AttendanceSheetList({ sheets, selectedSheetId, loading, onSelect }: Props) {
    if (loading) {
        return <p className="text-sm text-secondary/70">Loading attendance sheets...</p>
    }

    if (sheets.length === 0) {
        return (
            <p className="rounded-2xl border border-dashed border-secondary/30 bg-bg px-4 py-3 text-sm text-secondary/70">
                No custom attendance sheets yet.
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {sheets.map(sheet => (
                <button
                    key={sheet.id}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                        selectedSheetId === sheet.id
                            ? 'border-secondary bg-secondary text-accent'
                            : 'border-secondary/20 bg-bg text-secondary hover:bg-accent'
                    }`}
                    onClick={() => onSelect(sheet)}
                >
                    <span className="block text-sm font-semibold">{sheet.name}</span>
                    <span className="mt-1 block text-xs opacity-75">
                        {sheet.defaultForTemplate
                            ? `Default for ${sheet.defaultForTemplate}`
                            : sheet.baseTemplate
                              ? `Seeded from ${sheet.baseTemplate}`
                              : 'Standalone sheet'}
                    </span>
                </button>
            ))}
        </div>
    )
}

export default AttendanceSheetList
