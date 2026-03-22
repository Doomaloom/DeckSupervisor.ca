import React from 'react'
import { inputClass, selectClass } from '../../rosters/constants'
import type { RosterGroup } from '../../rosters/types'
import { dayNames } from '../constants'

type FullTimeRosterItem = {
    day: string
    roster: RosterGroup
}

type FullTimeRostersPanelProps = {
    dayOptions: string[]
    levelOptions: string[]
    dayFilter: string
    levelFilter: string
    searchQuery: string
    onUploadRoster: () => void
    onInstructorChange: (day: string, code: string, value: string) => void
    onDayFilterChange: (value: string) => void
    onLevelFilterChange: (value: string) => void
    onSearchChange: (value: string) => void
    rosters: FullTimeRosterItem[]
}

function FullTimeRostersPanel({
    dayOptions,
    levelOptions,
    dayFilter,
    levelFilter,
    searchQuery,
    onUploadRoster,
    onInstructorChange,
    onDayFilterChange,
    onLevelFilterChange,
    onSearchChange,
    rosters,
}: FullTimeRostersPanelProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Roster Filters</p>
                    <button
                        type="button"
                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                        onClick={onUploadRoster}
                    >
                        Upload Roster
                    </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select className={selectClass} value={dayFilter} onChange={event => onDayFilterChange(event.target.value)}>
                        <option value="">All Uploaded Days</option>
                        {dayOptions.map(day => (
                            <option key={day} value={day}>
                                {dayNames[day] ?? day}
                            </option>
                        ))}
                    </select>
                    <select className={selectClass} value={levelFilter} onChange={event => onLevelFilterChange(event.target.value)}>
                        <option value="">All Levels</option>
                        {levelOptions.map(level => (
                            <option key={level} value={level}>
                                {level}
                            </option>
                        ))}
                    </select>
                    <input
                        className={inputClass}
                        type="text"
                        placeholder="Search student or event ID"
                        value={searchQuery}
                        onChange={event => onSearchChange(event.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Uploaded Rosters</p>
                        <h3 className="mt-2 text-xl font-semibold">All Days</h3>
                    </div>
                    <p className="text-sm font-semibold text-secondary/70">
                        {rosters.length} roster{rosters.length === 1 ? '' : 's'}
                    </p>
                </div>

                {rosters.length === 0 ? (
                    <p className="mt-4 text-sm text-secondary/70">
                        No uploaded rosters match the current filters.
                    </p>
                ) : (
                    <div className="mt-5 flex flex-col gap-4">
                        {rosters.map(item => (
                            <article key={`${item.day}-${item.roster.code}`} className="rounded-2xl border border-secondary/20 bg-bg p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-accent">
                                                {dayNames[item.day] ?? item.day}
                                            </span>
                                            <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                                                {item.roster.code}
                                            </span>
                                        </div>
                                        <h4 className="mt-3 text-lg font-semibold">{item.roster.serviceName}</h4>
                                        <p className="mt-1 text-sm text-secondary/80">
                                            {item.roster.time || 'No time'} • {item.roster.location || 'No location'}
                                        </p>
                                        <label className="mt-3 flex max-w-sm flex-col gap-2 text-sm font-semibold text-secondary">
                                            Instructor
                                            <input
                                                className={inputClass}
                                                type="text"
                                                value={item.roster.instructor}
                                                placeholder="Set instructor"
                                                onChange={event =>
                                                    onInstructorChange(item.day, item.roster.code, event.target.value)
                                                }
                                            />
                                        </label>
                                    </div>
                                    <div className="text-right text-sm font-semibold text-secondary/70">
                                        <p>{item.roster.students.length} student{item.roster.students.length === 1 ? '' : 's'}</p>
                                        <p>{item.roster.level || 'No level'}</p>
                                    </div>
                                </div>

                                <div className="mt-4 overflow-hidden rounded-2xl border border-secondary/20">
                                    <table className="min-w-full border-collapse text-left text-sm">
                                        <thead className="bg-accent/70">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-secondary">Student</th>
                                                <th className="px-4 py-3 font-semibold text-secondary">Phone</th>
                                                <th className="px-4 py-3 font-semibold text-secondary">Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.roster.students.map(student => (
                                                <tr key={student.id} className="border-t border-secondary/15">
                                                    <td className="px-4 py-3">{student.name}</td>
                                                    <td className="px-4 py-3">{student.phone || 'No phone'}</td>
                                                    <td className="px-4 py-3">{student.level || item.roster.level || 'No level'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default FullTimeRostersPanel
