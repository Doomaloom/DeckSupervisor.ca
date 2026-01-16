import React, { useEffect, useMemo, useState } from 'react'
import { extractEndTime, extractStartTime } from '../../../lib/time'
import type { CustomRoster } from '../../../types/app'
import type { RosterGroup } from '../types'
import { buildCustomRosterGroups } from '../utils'
import { useRosterPrint } from '../hooks/useRosterPrint'
import InstructorSelect from './InstructorSelect'
import LevelSelect from './LevelSelect'

type CustomRostersPanelProps = {
    rosters: RosterGroup[]
    instructorOptions: string[]
    customRosters: CustomRoster[]
    onSave: (next: CustomRoster[]) => void
}

function buildTimeKey(time: string) {
    const start = extractStartTime(time)
    const end = extractEndTime(time)
    return `${start}-${end}`
}

function CustomRostersPanel({ rosters, instructorOptions, customRosters, onSave }: CustomRostersPanelProps) {
    const [isCreating, setIsCreating] = useState(false)
    const [editingRosterId, setEditingRosterId] = useState<string | null>(null)
    const [newLevel, setNewLevel] = useState('')
    const [newInstructor, setNewInstructor] = useState('')
    const [selectedSourceCodes, setSelectedSourceCodes] = useState<string[]>([])
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

    const rosterByCode = useMemo(() => new Map(rosters.map(roster => [roster.code, roster])), [rosters])
    const studentsById = useMemo(() => {
        const map = new Map<string, RosterGroup['students'][number]>()
        rosters.forEach(roster => {
            roster.students.forEach(student => map.set(student.id, student))
        })
        return map
    }, [rosters])
    const timeConstraint = useMemo(() => {
        for (const code of selectedSourceCodes) {
            const roster = rosterByCode.get(code)
            if (roster) {
                return buildTimeKey(roster.time)
            }
        }
        return null
    }, [selectedSourceCodes, rosterByCode])
    const availableSourceRosters = useMemo(() => {
        if (!timeConstraint) {
            return rosters
        }
        return rosters.filter(roster => buildTimeKey(roster.time) === timeConstraint)
    }, [rosters, timeConstraint])
    const selectedRosters = useMemo(
        () => selectedSourceCodes.map(code => rosterByCode.get(code)).filter(Boolean) as RosterGroup[],
        [rosterByCode, selectedSourceCodes],
    )
    const selectedTimeLabel = selectedRosters[0]?.time ?? ''
    const availableStudentIds = useMemo(() => {
        const ids = new Set<string>()
        selectedRosters.forEach(roster => {
            roster.students.forEach(student => ids.add(student.id))
        })
        return ids
    }, [selectedRosters])

    const { handlePrintRoster } = useRosterPrint()

    useEffect(() => {
        setSelectedSourceCodes(current => current.filter(code => rosterByCode.has(code)))
    }, [rosterByCode])

    useEffect(() => {
        setSelectedStudentIds(current => current.filter(id => availableStudentIds.has(id)))
    }, [availableStudentIds])

    const handleToggleSourceCode = (code: string) => {
        setSelectedSourceCodes(current => {
            const roster = rosterByCode.get(code)
            if (!roster) {
                return current
            }
            const rosterTimeKey = buildTimeKey(roster.time)
            if (timeConstraint && rosterTimeKey !== timeConstraint) {
                return current
            }
            const exists = current.includes(code)
            const next = exists ? current.filter(entry => entry !== code) : [...current, code]
            return next
        })
    }

    const handleToggleStudent = (studentId: string) => {
        setSelectedStudentIds(current =>
            current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId],
        )
    }

    const handleSelectAll = (roster: RosterGroup) => {
        setSelectedStudentIds(current => {
            const ids = roster.students.map(student => student.id)
            const next = new Set(current)
            ids.forEach(id => next.add(id))
            return Array.from(next)
        })
    }

    const handleClearSelection = () => {
        setSelectedSourceCodes([])
        setSelectedStudentIds([])
    }

    const resetEditor = () => {
        setIsCreating(false)
        setEditingRosterId(null)
        setNewLevel('')
        setNewInstructor('')
        handleClearSelection()
    }

    const handleCreateCustomRoster = () => {
        if (!newLevel) {
            alert('Please select a level for the new class.')
            return
        }
        if (selectedSourceCodes.length === 0) {
            alert('Please choose at least one source class.')
            return
        }
        if (selectedStudentIds.length === 0) {
            alert('Please select at least one student.')
            return
        }

        const next = editingRosterId
            ? customRosters.map(roster =>
                  roster.id === editingRosterId
                      ? {
                            ...roster,
                            serviceName: newLevel,
                            instructor: newInstructor || undefined,
                            sourceCodes: selectedSourceCodes,
                            studentIds: selectedStudentIds,
                        }
                      : roster,
              )
                  : [
                        ...customRosters,
                        {
                      id:
                          typeof crypto !== 'undefined' && 'randomUUID' in crypto
                              ? crypto.randomUUID()
                              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                      serviceName: newLevel,
                      instructor: newInstructor || undefined,
                      sourceCodes: selectedSourceCodes,
                      studentIds: selectedStudentIds,
                      createdAt: new Date().toISOString(),
                      },
              ]
        onSave(next)
        resetEditor()
    }

    const handleEditRoster = (roster: CustomRoster) => {
        setIsCreating(true)
        setEditingRosterId(roster.id)
        setNewLevel(roster.serviceName)
        setNewInstructor(roster.instructor ?? '')
        setSelectedSourceCodes(roster.sourceCodes.filter(code => rosterByCode.has(code)))
        setSelectedStudentIds(roster.studentIds)
    }

    const handleDeleteRoster = (rosterId: string) => {
        if (!confirm('Delete this custom roster?')) {
            return
        }
        const next = customRosters.filter(roster => roster.id !== rosterId)
        onSave(next)
        if (editingRosterId === rosterId) {
            resetEditor()
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Custom Rosters</h2>
                    <button
                        type="button"
                        className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                        onClick={() => (isCreating ? resetEditor() : setIsCreating(true))}
                    >
                        {isCreating ? 'Close Editor' : 'Create New Custom Roster'}
                    </button>
                </div>
                {customRosters.length === 0 ? (
                    <p className="mt-3 text-secondary">No custom rosters created yet.</p>
                ) : (
                    <div className="mt-4 flex flex-col gap-3">
                        {customRosters.map(roster => {
                            const sourceTimes = roster.sourceCodes
                                .map(code => rosterByCode.get(code)?.time)
                                .filter(Boolean)
                            const timeLabel = sourceTimes[0] ?? 'Time unknown'
                            const rosterGroup = buildCustomRosterGroups([roster], rosterByCode, studentsById)[0]
                            return (
                                <div key={roster.id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-secondary">{roster.serviceName}</p>
                                            <p className="text-sm text-secondary">
                                                {roster.instructor ? roster.instructor : 'No instructor assigned'}
                                            </p>
                                        </div>
                                        <div className="text-sm text-secondary">{timeLabel}</div>
                                    </div>
                                    <div className="mt-2 text-sm text-secondary">
                                        {roster.studentIds.length} students from {roster.sourceCodes.length} classes
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                            onClick={() => rosterGroup && handlePrintRoster(rosterGroup)}
                                        >
                                            Print
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                            onClick={() => handleEditRoster(roster)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-lg border border-danger/60 px-3 py-1 text-sm text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent"
                                            onClick={() => handleDeleteRoster(roster.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {isCreating ? (
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <h3 className="text-lg font-semibold">
                        {editingRosterId ? 'Edit Custom Roster' : 'Create Custom Roster'}
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <LevelSelect value={newLevel} onChange={setNewLevel} placeholder="Select Level" />
                        <InstructorSelect
                            value={newInstructor}
                            options={instructorOptions}
                            placeholder="Select Instructor"
                            onChange={setNewInstructor}
                        />
                    </div>

                    <div className="mt-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold">Select Source Classes</h4>
                            <button
                                type="button"
                                className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-bg"
                                onClick={handleClearSelection}
                            >
                                Clear Selection
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-secondary">
                            {selectedSourceCodes.length === 0
                                ? 'Pick a class to lock the time slot.'
                                : `Locked to ${selectedTimeLabel}.`}
                        </p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {availableSourceRosters.map(roster => (
                                <label
                                    key={roster.code}
                                    className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-bg px-3 py-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSourceCodes.includes(roster.code)}
                                        onChange={() => handleToggleSourceCode(roster.code)}
                                    />
                                    <span className="font-semibold">{roster.serviceName}</span>
                                    <span className="text-secondary">({roster.time})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6">
                        <h4 className="font-semibold">Select Students</h4>
                        {selectedRosters.length === 0 ? (
                            <p className="mt-2 text-sm text-secondary">Choose source classes to see students.</p>
                        ) : (
                            <div className="mt-3 flex flex-col gap-3">
                                {selectedRosters.map(roster => (
                                    <div key={roster.code} className="rounded-lg border border-secondary/20 bg-bg p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-sm font-semibold text-secondary">
                                                {roster.serviceName} ({roster.time})
                                            </div>
                                            <button
                                                type="button"
                                                className="rounded-lg border border-secondary/40 px-2 py-1 text-xs transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                                onClick={() => handleSelectAll(roster)}
                                            >
                                                Select All
                                            </button>
                                        </div>
                                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                                            {roster.students.map(student => (
                                                <label key={student.id} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudentIds.includes(student.id)}
                                                        onChange={() => handleToggleStudent(student.id)}
                                                    />
                                                    <span>{student.name.replaceAll('"', '')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            className="rounded-2xl bg-primary px-5 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                            onClick={handleCreateCustomRoster}
                        >
                            {editingRosterId ? 'Save Changes' : 'Create Custom Roster'}
                        </button>
                        <button
                            type="button"
                            className="rounded-2xl border border-secondary/60 px-5 py-2 text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                            onClick={resetEditor}
                        >
                            Cancel
                        </button>
                        <span className="text-sm text-secondary">
                            {selectedStudentIds.length} students selected
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default CustomRostersPanel
