import React from 'react'
import { inputClass } from '../constants'
import { dayNames } from '../../schematic/constants'
import type {
    FullTimeInstructorAssignments,
    FullTimeInstructorPeriod,
} from '../types'

type DayPeriod = {
    key: FullTimeInstructorPeriod
    label: string
    splitMinute: number | null
}

type FullTimeInstructorAssignmentsPanelProps = {
    dayKeys: string[]
    periodMap: Record<string, DayPeriod[]>
    assignments: FullTimeInstructorAssignments
    onInstructorChange: (day: string, period: FullTimeInstructorPeriod, index: number, value: string) => void
    onAddInstructor: (day: string, period: FullTimeInstructorPeriod) => void
    onRemoveInstructor: (day: string, period: FullTimeInstructorPeriod, index: number) => void
}

function FullTimeInstructorAssignmentsPanel({
    dayKeys,
    periodMap,
    assignments,
    onInstructorChange,
    onAddInstructor,
    onRemoveInstructor,
}: FullTimeInstructorAssignmentsPanelProps) {
    if (dayKeys.length === 0) {
        return (
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <p className="text-sm font-semibold text-secondary/70">
                    Upload a full-time roster CSV to configure instructor availability by day.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {dayKeys.map(day => {
                const dayAssignments = assignments[day]
                return (
                    <section key={day} className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                    Instructor Coverage
                                </p>
                                <h3 className="mt-2 text-xl font-semibold">{dayNames[day] ?? day}</h3>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-6 md:grid-cols-2">
                            {periodMap[day].map(period => {
                                const values = dayAssignments?.[period.key] ?? ['']
                                return (
                                    <div key={`${day}-${period.key}`} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h4 className="text-sm font-semibold text-secondary">{period.label}</h4>
                                            <button
                                                type="button"
                                                className="rounded-2xl bg-primary px-3 py-1.5 text-xs font-semibold text-accent transition hover:-translate-y-0.5"
                                                onClick={() => onAddInstructor(day, period.key)}
                                            >
                                                Add Instructor
                                            </button>
                                        </div>
                                        <div className="mt-4 flex flex-col gap-3">
                                            {values.map((value, index) => (
                                                <div key={`${day}-${period.key}-${index}`} className="flex items-center gap-3">
                                                    <input
                                                        className={inputClass}
                                                        type="text"
                                                        placeholder="Instructor name"
                                                        value={value}
                                                        onChange={event =>
                                                            onInstructorChange(day, period.key, index, event.target.value)
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        className="rounded-2xl border border-secondary/30 bg-accent px-3 py-2 text-xs font-semibold text-secondary transition hover:bg-bg"
                                                        onClick={() => onRemoveInstructor(day, period.key, index)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}

export default FullTimeInstructorAssignmentsPanel
