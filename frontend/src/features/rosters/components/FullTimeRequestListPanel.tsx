import React from 'react'
import { inputClass, selectClass } from '../constants'
import type { FullTimeRequestEntry, FullTimeRequestReason } from '../types'
import { fullTimeRequestReasonOptions } from '../fullTimePlanning'

type FullTimeRequestDraft = {
    firstName: string
    lastName: string
    phone: string
    instructor: string
}

type FullTimeRequestListPanelProps = {
    draft: FullTimeRequestDraft
    entries: FullTimeRequestEntry[]
    onDraftChange: (field: keyof FullTimeRequestDraft, value: string) => void
    onAddRequest: () => void
    onImportCsv: (file: File | null) => void
    onAutoAssign: () => void
    onEntryChange: <K extends keyof FullTimeRequestEntry>(id: string, field: K, value: FullTimeRequestEntry[K]) => void
    onDeleteRequest: (id: string) => void
}

function FullTimeRequestListPanel({
    draft,
    entries,
    onDraftChange,
    onAddRequest,
    onImportCsv,
    onAutoAssign,
    onEntryChange,
    onDeleteRequest,
}: FullTimeRequestListPanelProps) {
    const uploadInputRef = React.useRef<HTMLInputElement | null>(null)

    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <input
                    ref={uploadInputRef}
                    className="hidden"
                    type="file"
                    accept=".csv"
                    onChange={event => {
                        onImportCsv(event.target.files?.[0] ?? null)
                        event.target.value = ''
                    }}
                />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Request List</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">Add Student Request</h3>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                            onClick={() => uploadInputRef.current?.click()}
                        >
                            Import CSV
                        </button>
                        <button
                            type="button"
                            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                            onClick={onAutoAssign}
                        >
                            Auto Assign Requests
                        </button>
                    </div>
                </div>
                <p className="mt-3 text-sm text-secondary/70">
                    CSV columns: First Name, Last Name, Phone Number, Instructor Name
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <input
                        className={inputClass}
                        type="text"
                        placeholder="First name"
                        value={draft.firstName}
                        onChange={event => onDraftChange('firstName', event.target.value)}
                    />
                    <input
                        className={inputClass}
                        type="text"
                        placeholder="Last name"
                        value={draft.lastName}
                        onChange={event => onDraftChange('lastName', event.target.value)}
                    />
                    <input
                        className={inputClass}
                        type="text"
                        placeholder="Phone number"
                        value={draft.phone}
                        onChange={event => onDraftChange('phone', event.target.value)}
                    />
                    <input
                        className={inputClass}
                        type="text"
                        placeholder="Requested instructor"
                        value={draft.instructor}
                        onChange={event => onDraftChange('instructor', event.target.value)}
                    />
                </div>
                <button
                    type="button"
                    className="mt-4 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                    onClick={onAddRequest}
                >
                    Add Request
                </button>
            </section>

            <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Tracked Requests</p>
                        <h3 className="mt-2 text-xl font-semibold">{entries.length} Request{entries.length === 1 ? '' : 's'}</h3>
                    </div>
                </div>

                {entries.length === 0 ? (
                    <p className="mt-4 text-sm text-secondary/70">No requests added yet.</p>
                ) : (
                    <div className="mt-5 flex flex-col gap-4">
                        {entries.map(entry => (
                            <article key={entry.id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                <div className="grid gap-3 md:grid-cols-4">
                                    <input
                                        className={inputClass}
                                        type="text"
                                        value={entry.firstName}
                                        placeholder="First name"
                                        onChange={event => onEntryChange(entry.id, 'firstName', event.target.value)}
                                    />
                                    <input
                                        className={inputClass}
                                        type="text"
                                        value={entry.lastName}
                                        placeholder="Last name"
                                        onChange={event => onEntryChange(entry.id, 'lastName', event.target.value)}
                                    />
                                    <input
                                        className={inputClass}
                                        type="text"
                                        value={entry.phone}
                                        placeholder="Phone number"
                                        onChange={event => onEntryChange(entry.id, 'phone', event.target.value)}
                                    />
                                    <input
                                        className={inputClass}
                                        type="text"
                                        value={entry.instructor}
                                        placeholder="Requested instructor"
                                        onChange={event => onEntryChange(entry.id, 'instructor', event.target.value)}
                                    />
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                                        <input
                                            type="checkbox"
                                            checked={entry.accommodated}
                                            onChange={event => onEntryChange(entry.id, 'accommodated', event.target.checked)}
                                        />
                                        Accommodated
                                    </label>

                                    {!entry.accommodated ? (
                                        <select
                                            className={selectClass}
                                            value={entry.reason}
                                            onChange={event =>
                                                onEntryChange(entry.id, 'reason', event.target.value as FullTimeRequestReason)
                                            }
                                        >
                                            <option value="">Select reason</option>
                                            {fullTimeRequestReasonOptions.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : null}

                                    <button
                                        type="button"
                                        className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/20"
                                        onClick={() => onDeleteRequest(entry.id)}
                                    >
                                        Delete
                                    </button>
                                </div>

                                {entry.matchedCode ? (
                                    <div className="mt-4 rounded-2xl border border-secondary/15 bg-accent/60 px-4 py-3 text-sm text-secondary/80">
                                        <p>
                                            Matched by <span className="font-semibold">{entry.matchedBy || 'auto-assign'}</span> to{' '}
                                            <span className="font-semibold">
                                                {entry.matchedServiceName || entry.matchedCode}
                                            </span>
                                            {entry.matchedDay ? ` • ${entry.matchedDay}` : ''}
                                            {entry.matchedTime ? ` • ${entry.matchedTime}` : ''}
                                        </p>
                                        <p className="mt-1">
                                            Requests for this class/instructor:{' '}
                                            <span className="font-semibold">{entry.matchedRequestCount}</span>
                                        </p>
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default FullTimeRequestListPanel
