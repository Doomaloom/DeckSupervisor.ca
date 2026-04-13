import { useEffect, useMemo, useState } from 'react'
import {
  createRequestAssignment,
  deleteRequestAssignment,
  fetchCsvAnalyze,
  fetchRequestAssignments,
  updateRequestAssignment,
} from '../../lib/serverApi'
import type { ClassRoster, RequestAssignment } from '../../types/app'
import {
  analyzeInstructorRequests,
  parseRequestsCsv,
  type RequestsAnalysisResult,
} from './requestsAnalysis'
import {
  buildAssignmentKey,
  buildRosterClassKey,
  formatDayLabel,
  sortAssignments,
} from './utils/assignmentKeys'

type LoadedRequestsFile = {
  file: File
  rows: ReturnType<typeof parseRequestsCsv>
}

type LoadedRosterFile = {
  file: File
  classes: ClassRoster[]
  defaultTerm: string
  classTerms: Record<string, string>
}

type AssignmentDraft = {
  id: string
  eventId: string
  term: string
  location: string
  instructor: string
}

const emptyAssignmentDraft: AssignmentDraft = {
  id: '',
  eventId: '',
  term: '',
  location: '',
  instructor: '',
}

function tabButtonClass(active: boolean) {
  return [
    'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
    active
      ? 'border-secondary bg-secondary text-accent'
      : 'border-secondary/30 bg-bg text-secondary hover:bg-accent',
  ].join(' ')
}

function RequestsPage() {
  const [activeTab, setActiveTab] = useState<'summary' | 'assignments'>('summary')
  const [requestsFile, setRequestsFile] = useState<LoadedRequestsFile | null>(null)
  const [rosterFile, setRosterFile] = useState<LoadedRosterFile | null>(null)
  const [analysis, setAnalysis] = useState<RequestsAnalysisResult | null>(null)
  const [assignments, setAssignments] = useState<RequestAssignment[]>([])
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(emptyAssignmentDraft)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)

  useEffect(() => {
    let active = true
    const loadAssignments = async () => {
      setAssignmentsLoading(true)
      try {
        const response = await fetchRequestAssignments()
        if (!active) {
          return
        }
        setAssignments(sortAssignments(response.assignments ?? []))
      } catch (loadError) {
        console.error(loadError)
        if (!active) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load request assignments.')
      } finally {
        if (active) {
          setAssignmentsLoading(false)
        }
      }
    }

    void loadAssignments()
    return () => {
      active = false
    }
  }, [])

  const availableDays = useMemo(() => analysis?.days.map(entry => entry.day) ?? [], [analysis])
  const autoAssignmentCandidates = useMemo(() => {
    if (!analysis || !rosterFile) {
      return []
    }

    const existingKeys = new Set(
      assignments.map(assignment => buildAssignmentKey(assignment.eventId, assignment.term, assignment.location)),
    )

    return analysis.days.flatMap(dayGroup =>
      dayGroup.classes.flatMap(classSummary => {
        const instructor = classSummary.instructorCounts[0]?.instructor?.trim() ?? ''
        const location = classSummary.location.trim()
        const term =
          rosterFile.classTerms[buildRosterClassKey(dayGroup.day, classSummary.eventId, classSummary.location)] ??
          rosterFile.defaultTerm ??
          ''
        if (!classSummary.eventId.trim() || !instructor || !location || !term.trim()) {
          return []
        }
        const key = buildAssignmentKey(classSummary.eventId, term, location)
        if (existingKeys.has(key)) {
          return []
        }
        existingKeys.add(key)
        return [{
          eventId: classSummary.eventId.trim(),
          term: term.trim(),
          location,
          instructor,
        }]
      }),
    )
  }, [analysis, assignments, rosterFile])

  const handleRequestsUpload = async (file: File | null) => {
    if (!file) {
      return
    }

    setError('')
    setStatus('Reading requests CSV...')
    setAnalysis(null)

    try {
      const text = await file.text()
      const rows = parseRequestsCsv(text)
      setRequestsFile({ file, rows })
      setStatus(`Loaded ${rows.length} request rows from ${file.name}.`)
    } catch (uploadError) {
      console.error(uploadError)
      setRequestsFile(null)
      setStatus('')
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the requests CSV.')
    }
  }

  const handleRosterUpload = async (file: File | null) => {
    if (!file) {
      return
    }

    setError('')
    setStatus('Processing roster/export CSV...')
    setAnalysis(null)
    setIsLoading(true)

    try {
      const analyzed = await fetchCsvAnalyze(file)
      const classes = analyzed.rosters ?? []
      const extracted = analyzed.extracted
      const classTerms: Record<string, string> = {}
      const termSet = new Set<string>()

      ;(extracted.sessions ?? []).forEach(session => {
        const term = [session.sessionSeason.trim(), session.sessionYear > 0 ? String(session.sessionYear) : '']
          .filter(Boolean)
          .join(' ')
        if (term) {
          termSet.add(term)
        }
        ;(extracted.classesBySession?.[session.sessionKey] ?? []).forEach(classEntry => {
          classTerms[buildRosterClassKey(classEntry.dayOfWeek, classEntry.courseCode, classEntry.location)] = term
        })
      })

      setRosterFile({
        file,
        classes,
        defaultTerm: Array.from(termSet)[0] ?? '',
        classTerms,
      })
      setStatus(`Loaded ${classes.length} classes from ${file.name}.`)
    } catch (uploadError) {
      console.error(uploadError)
      setRosterFile(null)
      setStatus('')
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to process the roster CSV.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnalyze = () => {
    if (!requestsFile) {
      setError('Upload the requests CSV first.')
      return
    }
    if (!rosterFile) {
      setError('Upload the roster/export CSV first.')
      return
    }

    setError('')
    setStatus('Building request summary...')
    const result = analyzeInstructorRequests(requestsFile.rows, rosterFile.classes)
    setAnalysis(result)

    if (result.days.length === 0) {
      setStatus('No matching classes were found for the uploaded requests.')
      return
    }

    setStatus(
      `Matched ${result.matchedDayEntries} request entries across ${result.days.length} day${result.days.length === 1 ? '' : 's'}.`,
    )
  }

  const beginAssignmentDraft = (draft: Partial<AssignmentDraft>) => {
    setAssignmentDraft(current => ({
      ...current,
      ...draft,
    }))
    setActiveTab('assignments')
  }

  const handleAddFromSummary = (day: string, classSummary: RequestsAnalysisResult['days'][number]['classes'][number]) => {
    const key = buildRosterClassKey(day, classSummary.eventId, classSummary.location)
    const term = rosterFile?.classTerms[key] ?? rosterFile?.defaultTerm ?? ''
    const existing = assignments.find(
      assignment =>
        assignment.eventId === classSummary.eventId &&
        assignment.location === classSummary.location &&
        assignment.term === term,
    )
    const topInstructor = classSummary.instructorCounts[0]?.instructor ?? ''

    beginAssignmentDraft(
      existing
        ? {
            id: existing.id,
            eventId: existing.eventId,
            term: existing.term,
            location: existing.location,
            instructor: existing.instructor,
          }
        : {
            id: '',
            eventId: classSummary.eventId,
            term,
            location: classSummary.location,
            instructor: topInstructor,
          },
    )
    setStatus(existing ? 'Loaded existing assignment for editing.' : 'Assignment draft created from summary.')
    setError('')
  }

  const handleEditAssignment = (assignment: RequestAssignment) => {
    beginAssignmentDraft({
      id: assignment.id,
      eventId: assignment.eventId,
      term: assignment.term,
      location: assignment.location,
      instructor: assignment.instructor,
    })
    setStatus('Assignment loaded for editing.')
    setError('')
  }

  const resetAssignmentDraft = () => {
    setAssignmentDraft(emptyAssignmentDraft)
  }

  const handleSaveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const eventId = assignmentDraft.eventId.trim()
    const term = assignmentDraft.term.trim()
    const location = assignmentDraft.location.trim()
    const instructor = assignmentDraft.instructor.trim()

    if (!eventId || !term || !location || !instructor) {
      setError('Event ID, term, location, and instructor are all required.')
      return
    }

    setError('')
    setAssignmentSaving(true)
    try {
      const response = assignmentDraft.id
        ? await updateRequestAssignment(assignmentDraft.id, { eventId, term, location, instructor })
        : await createRequestAssignment({ eventId, term, location, instructor })
      const nextAssignment = response.assignment
      setAssignments(current => {
        const filtered = current.filter(assignment => assignment.id !== nextAssignment.id)
        return sortAssignments([...filtered, nextAssignment])
      })
      resetAssignmentDraft()
      setStatus(assignmentDraft.id ? 'Assignment updated.' : 'Assignment saved.')
    } catch (saveError) {
      console.error(saveError)
      setError(saveError instanceof Error ? saveError.message : 'Failed to save assignment.')
    } finally {
      setAssignmentSaving(false)
    }
  }

  const handleDeleteAssignment = async (assignment: RequestAssignment) => {
    if (!confirm(`Delete assignment for ${assignment.eventId} (${assignment.term})?`)) {
      return
    }

    setError('')
    setAssignmentSaving(true)
    try {
      await deleteRequestAssignment(assignment.id)
      setAssignments(current => current.filter(entry => entry.id !== assignment.id))
      if (assignmentDraft.id === assignment.id) {
        resetAssignmentDraft()
      }
      setStatus('Assignment deleted.')
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete assignment.')
    } finally {
      setAssignmentSaving(false)
    }
  }

  const handleAutoAssignMissing = async () => {
    if (autoAssignmentCandidates.length === 0) {
      setStatus('No missing assignments were found in the current summary.')
      setError('')
      return
    }

    setError('')
    setAssignmentSaving(true)

    const created: RequestAssignment[] = []
    const failures: string[] = []

    for (const candidate of autoAssignmentCandidates) {
      try {
        const response = await createRequestAssignment(candidate)
        created.push(response.assignment)
      } catch (saveError) {
        console.error(saveError)
        failures.push(`${candidate.eventId} (${candidate.term} • ${candidate.location})`)
      }
    }

    if (created.length > 0) {
      setAssignments(current => sortAssignments([...current, ...created]))
    }

    if (failures.length > 0) {
      setError(`Failed to save ${failures.length} assignment${failures.length === 1 ? '' : 's'}: ${failures.join(', ')}`)
    }

    setStatus(
      failures.length > 0
        ? `Saved ${created.length} missing assignment${created.length === 1 ? '' : 's'}.`
        : `Saved ${created.length} missing assignment${created.length === 1 ? '' : 's'} automatically.`,
    )
    setAssignmentSaving(false)
  }

  return (
    <div id="requests-page" data-component="requests-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">Requests</p>
          <h2 className="mt-3 text-2xl font-semibold">Instructor Request Summary</h2>
          <p className="mt-2 max-w-3xl text-secondary/80">
            Upload the requests CSV and the registered-class roster export, then save event ID to instructor assignments that can autofill future part-time roster imports.
          </p>
        </div>
      </div>

      <section className="sticky top-4 z-10 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Page View</p>
            <p className="mt-1 text-sm text-secondary/80">
              Switch between the request summary and saved instructor assignments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabButtonClass(activeTab === 'summary')} onClick={() => setActiveTab('summary')}>
              Summary
            </button>
            <button type="button" className={tabButtonClass(activeTab === 'assignments')} onClick={() => setActiveTab('assignments')}>
              Assignments
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
              Import Files
            </p>
            <h3 className="mt-2 text-lg font-semibold">Two-file workflow</h3>
            <p className="mt-2 max-w-2xl text-sm text-secondary/70">
              The requests file needs first name, last name, instructor requested, and day of week. The roster/export file should be the regular registration CSV with student names, event IDs, and class details.
            </p>
          </div>
          <button
            type="button"
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleAnalyze}
            disabled={!requestsFile || !rosterFile || isLoading}
          >
            {isLoading ? 'Loading...' : 'Build Summary'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="relative flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-2xl border-2 border-dashed border-secondary/30 bg-bg p-5 transition hover:-translate-y-0.5 hover:border-primary">
            <div>
              <p className="text-sm font-semibold text-secondary">Requests CSV</p>
              <p className="mt-2 text-sm text-secondary/70">
                Upload the spreadsheet export containing the student request rows.
              </p>
            </div>
            <p className="mt-4 text-sm font-semibold text-primary">
              {requestsFile ? requestsFile.file.name : 'Choose requests CSV'}
            </p>
            <input
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              accept=".csv"
              onChange={event => {
                void handleRequestsUpload(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
            />
          </label>

          <label className="relative flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-2xl border-2 border-dashed border-secondary/30 bg-bg p-5 transition hover:-translate-y-0.5 hover:border-primary">
            <div>
              <p className="text-sm font-semibold text-secondary">Roster / Export CSV</p>
              <p className="mt-2 text-sm text-secondary/70">
                Upload the registration export that includes student names and class assignments.
              </p>
            </div>
            <p className="mt-4 text-sm font-semibold text-primary">
              {rosterFile ? rosterFile.file.name : 'Choose roster/export CSV'}
            </p>
            <input
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              accept=".csv"
              onChange={event => {
                void handleRosterUpload(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
            />
          </label>
        </div>

        {status ? <p className="mt-4 text-sm font-semibold text-secondary/80">{status}</p> : null}
        {error ? (
          <div className="mt-4 rounded-card border-2 border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}
      </section>

      {activeTab === 'summary' ? (
        analysis ? (
          <>
            <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    Assignment Automation
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">Auto-save missing assignments</h3>
                  <p className="mt-2 text-sm text-secondary/70">
                    Save every matched class to the assignments table using its top requested instructor, while skipping rows that already exist.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-secondary/70">
                    {autoAssignmentCandidates.length} missing assignment{autoAssignmentCandidates.length === 1 ? '' : 's'}
                  </p>
                  <button
                    type="button"
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleAutoAssignMissing()}
                    disabled={assignmentSaving || autoAssignmentCandidates.length === 0}
                  >
                    {assignmentSaving ? 'Saving...' : 'Auto Assign Missing'}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Rows</p>
                <p className="mt-3 text-3xl font-semibold">{analysis.totalRequests}</p>
                <p className="mt-2 text-sm text-secondary/70">Request rows loaded from the requests CSV.</p>
              </div>
              <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Day Entries</p>
                <p className="mt-3 text-3xl font-semibold">{analysis.totalDayEntries}</p>
                <p className="mt-2 text-sm text-secondary/70">Expanded request entries after splitting multi-day values.</p>
              </div>
              <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Matched</p>
                <p className="mt-3 text-3xl font-semibold">{analysis.matchedDayEntries}</p>
                <p className="mt-2 text-sm text-secondary/70">Request/day entries that mapped to at least one class.</p>
              </div>
              <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Unmatched</p>
                <p className="mt-3 text-3xl font-semibold">{analysis.unmatched.length}</p>
                <p className="mt-2 text-sm text-secondary/70">Rows needing cleanup or manual review.</p>
              </div>
              <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Days</p>
                <p className="mt-3 text-3xl font-semibold">{analysis.days.length}</p>
                <p className="mt-2 text-sm text-secondary/70">
                  {availableDays.length > 0 ? availableDays.map(formatDayLabel).join(', ') : 'No matched days'}
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              {analysis.days.length === 0 ? (
                <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                  No classes matched the uploaded requests. Review the unmatched section below to see which names or days need cleanup.
                </div>
              ) : null}

              {analysis.days.map(dayGroup => (
                <div
                  key={dayGroup.day}
                  className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                        {dayGroup.day}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">{formatDayLabel(dayGroup.day)}</h3>
                    </div>
                    <p className="text-sm font-semibold text-secondary/70">
                      {dayGroup.classes.length} class{dayGroup.classes.length === 1 ? '' : 'es'}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {dayGroup.classes.map(classSummary => (
                      <article
                        key={`${dayGroup.day}-${classSummary.eventId}`}
                        className="rounded-2xl border border-secondary/20 bg-bg p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                              Event ID
                            </p>
                            <h4 className="mt-2 text-lg font-semibold">{classSummary.eventId}</h4>
                            <p className="mt-2 text-sm text-secondary/80">
                              {classSummary.serviceName || 'Unknown level'} • {classSummary.time || 'No time'}
                            </p>
                            <p className="mt-1 text-sm text-secondary/70">
                              {classSummary.location || 'No location'}
                              {classSummary.schedule ? ` • ${classSummary.schedule}` : ''}
                            </p>
                          </div>
                          <div className="grid gap-2 text-right text-sm font-semibold text-secondary/80">
                            <p>{classSummary.matchedRequestCount} matched request entries</p>
                            <p>{classSummary.uniqueStudentCount} unique students</p>
                            <button
                              type="button"
                              className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                              onClick={() => handleAddFromSummary(dayGroup.day, classSummary)}
                            >
                              Add Assignment
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-2xl border border-secondary/20">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead className="bg-accent/70">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-secondary">Requested Instructor</th>
                                <th className="px-4 py-3 text-right font-semibold text-secondary">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {classSummary.instructorCounts.map(entry => (
                                <tr key={`${classSummary.eventId}-${entry.instructor}`} className="border-t border-secondary/15">
                                  <td className="px-4 py-3">{entry.instructor}</td>
                                  <td className="px-4 py-3 text-right font-semibold">{entry.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    Cleanup Queue
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Unmatched Requests</h3>
                </div>
                <p className="text-sm font-semibold text-secondary/70">
                  {analysis.unmatched.length} row{analysis.unmatched.length === 1 ? '' : 's'}
                </p>
              </div>

              {analysis.unmatched.length === 0 ? (
                <p className="mt-4 text-sm text-secondary/70">
                  Every uploaded request matched at least one registered class on its requested day.
                </p>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-secondary/20">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-bg">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-secondary">Row</th>
                        <th className="px-4 py-3 font-semibold text-secondary">Student</th>
                        <th className="px-4 py-3 font-semibold text-secondary">Requested Instructor</th>
                        <th className="px-4 py-3 font-semibold text-secondary">Day</th>
                        <th className="px-4 py-3 font-semibold text-secondary">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.unmatched.map(entry => (
                        <tr
                          key={`${entry.request.rowNumber}-${entry.requestedDay}-${entry.reason}`}
                          className="border-t border-secondary/15"
                        >
                          <td className="px-4 py-3">{entry.request.rowNumber}</td>
                          <td className="px-4 py-3">{entry.request.fullName || 'Missing name'}</td>
                          <td className="px-4 py-3">{entry.request.requestedInstructor || 'Missing instructor'}</td>
                          <td className="px-4 py-3">
                            {entry.requestedDay
                              ? formatDayLabel(entry.requestedDay)
                              : entry.request.originalDayValue || 'Missing day'}
                          </td>
                          <td className="px-4 py-3 text-secondary/80">{entry.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
            Upload both CSV files, then build the summary to review request counts by class.
          </div>
        )
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <form
            className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
            onSubmit={handleSaveAssignment}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
              Assignment Editor
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {assignmentDraft.id ? 'Edit Assignment' : 'Add Assignment'}
            </h3>
            <p className="mt-2 text-sm text-secondary/70">
              Save a default instructor for an event ID, term, and location so future part-time roster imports can prefill it automatically.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                Event ID
                <input
                  className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                  value={assignmentDraft.eventId}
                  onChange={event => setAssignmentDraft(current => ({ ...current, eventId: event.target.value }))}
                  placeholder="123456"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                Term
                <input
                  className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                  value={assignmentDraft.term}
                  onChange={event => setAssignmentDraft(current => ({ ...current, term: event.target.value }))}
                  placeholder={rosterFile?.defaultTerm || 'Spring 2026'}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                Location
                <input
                  className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                  value={assignmentDraft.location}
                  onChange={event => setAssignmentDraft(current => ({ ...current, location: event.target.value }))}
                  placeholder="Pool / facility"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                Instructor
                <input
                  className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                  value={assignmentDraft.instructor}
                  onChange={event => setAssignmentDraft(current => ({ ...current, instructor: event.target.value }))}
                  placeholder="Instructor name"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={assignmentSaving}
              >
                {assignmentSaving ? 'Saving...' : assignmentDraft.id ? 'Update Assignment' : 'Save Assignment'}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                onClick={resetAssignmentDraft}
                disabled={assignmentSaving}
              >
                Clear
              </button>
            </div>
          </form>

          <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                  Saved Assignments
                </p>
                <h3 className="mt-2 text-xl font-semibold">Assignment Table</h3>
              </div>
              <p className="text-sm font-semibold text-secondary/70">
                {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
              </p>
            </div>

            {assignmentsLoading ? (
              <p className="mt-4 text-sm text-secondary/70">Loading assignments...</p>
            ) : assignments.length === 0 ? (
              <p className="mt-4 text-sm text-secondary/70">
                No saved assignments yet. Add one manually or use the add button from the summary tab.
              </p>
            ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-secondary/20">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-bg">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-secondary">Event ID</th>
                      <th className="px-4 py-3 font-semibold text-secondary">Term</th>
                      <th className="px-4 py-3 font-semibold text-secondary">Location</th>
                      <th className="px-4 py-3 font-semibold text-secondary">Instructor</th>
                      <th className="px-4 py-3 text-right font-semibold text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(assignment => (
                      <tr key={assignment.id} className="border-t border-secondary/15">
                        <td className="px-4 py-3">{assignment.eventId}</td>
                        <td className="px-4 py-3">{assignment.term}</td>
                        <td className="px-4 py-3">{assignment.location}</td>
                        <td className="px-4 py-3">{assignment.instructor}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-secondary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                              onClick={() => handleEditAssignment(assignment)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition hover:-translate-y-0.5"
                              onClick={() => void handleDeleteAssignment(assignment)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default RequestsPage
