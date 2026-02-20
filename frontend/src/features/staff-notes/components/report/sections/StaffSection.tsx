import type { ReportSectionProps } from '../types'
import {
  parseStrengthWeakness,
  sanitizeStrengthWeaknessItem,
  serializeStrengthWeakness,
} from '../../../utils/reportData'

type StaffSectionProps = ReportSectionProps & {
  reportInstructorOptions: string[]
}

function StaffSection({
  reportDraft,
  updateReportDraft,
  canEditSelectedReport,
  isReportInputDisabled,
  reportInstructorOptions,
}: StaffSectionProps) {
  const updateStrengthWeakness = (
    instructorIndex: number,
    updater: (value: { strengths: string[]; weaknesses: string[] }) => {
      strengths: string[]
      weaknesses: string[]
    },
  ) => {
    updateReportDraft(current => ({
      ...current,
      staff: {
        ...current.staff,
        strengthWeakness: current.staff.strengthWeakness.map((row, rowIndex) => {
          if (rowIndex !== instructorIndex) {
            return row
          }
          const parsed = parseStrengthWeakness(row.text)
          const next = updater(parsed)
          return {
            ...row,
            text: serializeStrengthWeakness(next),
          }
        }),
      },
    }))
  }

  const successionInstructorOptions = Array.from(
    new Set([
      ...reportDraft.staff.performance.map(entry => entry.instructor.trim()),
      ...reportDraft.staff.successionPlans.map(entry => entry.instructor.trim()),
    ]).values(),
  ).filter(Boolean)

  const successionPlanByInstructor = new Map(
    reportDraft.staff.successionPlans.map(entry => [entry.instructor, entry.text]),
  )

  const selectedSuccessionRows = successionInstructorOptions
    .filter(instructor => successionPlanByInstructor.has(instructor))
    .map(instructor => ({
      instructor,
      text: successionPlanByInstructor.get(instructor) ?? '',
    }))

  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <h3 className="text-base font-semibold">1) Staff</h3>
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-secondary">Performance (per instructor)</p>
          {reportDraft.staff.performance.length === 0 ? (
            <p className="text-sm text-secondary/70">No instructors found for this session.</p>
          ) : (
            reportDraft.staff.performance.map((entry, index) => (
              <label key={`${entry.instructor}-performance-${index}`} className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">{entry.instructor}</span>
                <textarea
                  className="min-h-[90px] rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-sm text-secondary"
                  value={entry.text}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      staff: {
                        ...current.staff,
                        performance: current.staff.performance.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, text: event.target.value } : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
              </label>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-secondary">Strengths / Weaknesses (per instructor)</p>
          <p className="text-xs text-secondary/70">Use bullets. The `|` character is not allowed.</p>
          {reportDraft.staff.strengthWeakness.length === 0 ? (
            <p className="text-sm text-secondary/70">No instructors found for this session.</p>
          ) : (
            reportDraft.staff.strengthWeakness.map((entry, index) => {
              const parsed = parseStrengthWeakness(entry.text)

              return (
                <div key={`${entry.instructor}-strength-${index}`} className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-secondary">{entry.instructor}</span>
                  <div className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">Strengths</p>
                        {canEditSelectedReport ? (
                          <button
                            type="button"
                            className="rounded-2xl bg-secondary px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                            onClick={() =>
                              updateStrengthWeakness(index, current => ({
                                strengths: [...current.strengths, ''],
                                weaknesses: current.weaknesses,
                              }))
                            }
                            disabled={isReportInputDisabled}
                          >
                            Add
                          </button>
                        ) : null}
                      </div>

                      {parsed.strengths.length === 0 ? (
                        <p className="text-xs text-secondary/60">No strengths added.</p>
                      ) : (
                        parsed.strengths.map((item, itemIndex) => (
                          <div key={`${entry.instructor}-strength-item-${itemIndex}`} className="flex items-center gap-2">
                            <span className="text-sm text-secondary/70">-</span>
                            <input
                              className="flex-1 rounded-xl border border-secondary/30 bg-bg px-2 py-1 text-sm text-secondary"
                              type="text"
                              value={item}
                              onChange={event =>
                                updateStrengthWeakness(index, current => ({
                                  strengths: current.strengths.map((row, rowIndex) =>
                                    rowIndex === itemIndex
                                      ? sanitizeStrengthWeaknessItem(event.target.value)
                                      : row,
                                  ),
                                  weaknesses: current.weaknesses,
                                }))
                              }
                              disabled={isReportInputDisabled}
                            />
                            {canEditSelectedReport ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                                onClick={() =>
                                  updateStrengthWeakness(index, current => ({
                                    strengths: current.strengths.filter(
                                      (_row, rowIndex) => rowIndex !== itemIndex,
                                    ),
                                    weaknesses: current.weaknesses,
                                  }))
                                }
                                disabled={isReportInputDisabled}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">Weaknesses</p>
                        {canEditSelectedReport ? (
                          <button
                            type="button"
                            className="rounded-2xl bg-secondary px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                            onClick={() =>
                              updateStrengthWeakness(index, current => ({
                                strengths: current.strengths,
                                weaknesses: [...current.weaknesses, ''],
                              }))
                            }
                            disabled={isReportInputDisabled}
                          >
                            Add
                          </button>
                        ) : null}
                      </div>

                      {parsed.weaknesses.length === 0 ? (
                        <p className="text-xs text-secondary/60">No weaknesses added.</p>
                      ) : (
                        parsed.weaknesses.map((item, itemIndex) => (
                          <div key={`${entry.instructor}-weakness-item-${itemIndex}`} className="flex items-center gap-2">
                            <span className="text-sm text-secondary/70">-</span>
                            <input
                              className="flex-1 rounded-xl border border-secondary/30 bg-bg px-2 py-1 text-sm text-secondary"
                              type="text"
                              value={item}
                              onChange={event =>
                                updateStrengthWeakness(index, current => ({
                                  strengths: current.strengths,
                                  weaknesses: current.weaknesses.map((row, rowIndex) =>
                                    rowIndex === itemIndex
                                      ? sanitizeStrengthWeaknessItem(event.target.value)
                                      : row,
                                  ),
                                }))
                              }
                              disabled={isReportInputDisabled}
                            />
                            {canEditSelectedReport ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                                onClick={() =>
                                  updateStrengthWeakness(index, current => ({
                                    strengths: current.strengths,
                                    weaknesses: current.weaknesses.filter(
                                      (_row, rowIndex) => rowIndex !== itemIndex,
                                    ),
                                  }))
                                }
                                disabled={isReportInputDisabled}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-secondary">
          Succession plans (certifications, supervisor path, etc.)
        </p>
        <div className="rounded-2xl border border-secondary/20 bg-accent p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">Include Instructors</p>
          {successionInstructorOptions.length === 0 ? (
            <p className="mt-2 text-sm text-secondary/70">No instructors found for this session.</p>
          ) : (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {successionInstructorOptions.map(instructor => {
                const isSelected = successionPlanByInstructor.has(instructor)
                return (
                  <label key={`succession-select-${instructor}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={event =>
                        updateReportDraft(current => ({
                          ...current,
                          staff: {
                            ...current.staff,
                            successionPlans: event.target.checked
                              ? current.staff.successionPlans.some(row => row.instructor === instructor)
                                ? current.staff.successionPlans
                                : [...current.staff.successionPlans, { instructor, text: '' }]
                              : current.staff.successionPlans.filter(row => row.instructor !== instructor),
                          },
                        }))
                      }
                      disabled={isReportInputDisabled}
                    />
                    <span className="text-secondary">{instructor}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {selectedSuccessionRows.length === 0 ? (
          <p className="text-sm text-secondary/70">No instructors selected for succession plans.</p>
        ) : (
          selectedSuccessionRows.map(entry => (
            <label key={`succession-plan-${entry.instructor}`} className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">{entry.instructor}</span>
              <textarea
                className="min-h-[90px] rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-sm text-secondary"
                value={entry.text}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    staff: {
                      ...current.staff,
                      successionPlans: current.staff.successionPlans.map(row =>
                        row.instructor === entry.instructor
                          ? {
                              ...row,
                              text: event.target.value,
                            }
                          : row,
                      ),
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              />
            </label>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-secondary">Instructor covers (optional)</p>
          {canEditSelectedReport ? (
            <button
              type="button"
              className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
              onClick={() =>
                updateReportDraft(current => ({
                  ...current,
                  staff: {
                    ...current.staff,
                    instructorCovers: [
                      ...current.staff.instructorCovers,
                      {
                        instructor: reportInstructorOptions[0] ?? '',
                        coveredBy: '',
                        details: '',
                      },
                    ],
                  },
                }))
              }
              disabled={isReportInputDisabled}
            >
              Add Cover
            </button>
          ) : null}
        </div>
        {reportDraft.staff.instructorCovers.length === 0 ? (
          <p className="text-sm text-secondary/70">No instructor covers added.</p>
        ) : (
          reportDraft.staff.instructorCovers.map((entry, index) => (
            <div
              key={`cover-${index}`}
              className="flex flex-col gap-3 rounded-2xl border border-secondary/20 bg-accent p-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <select
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary md:w-64"
                  value={entry.instructor}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      staff: {
                        ...current.staff,
                        instructorCovers: current.staff.instructorCovers.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                instructor: event.target.value,
                              }
                            : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled || reportInstructorOptions.length === 0}
                >
                  {reportInstructorOptions.length === 0 ? <option value="">No instructors available</option> : null}
                  {reportInstructorOptions.map(name => (
                    <option key={`cover-option-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary md:flex-1"
                  type="text"
                  placeholder="Instructor covering shift"
                  value={entry.coveredBy}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      staff: {
                        ...current.staff,
                        instructorCovers: current.staff.instructorCovers.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                coveredBy: event.target.value,
                              }
                            : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
                {canEditSelectedReport ? (
                  <button
                    type="button"
                    className="w-fit rounded-2xl bg-danger px-3 py-2 text-xs font-semibold text-accent transition hover:bg-dangerHover"
                    onClick={() =>
                      updateReportDraft(current => ({
                        ...current,
                        staff: {
                          ...current.staff,
                          instructorCovers: current.staff.instructorCovers.filter(
                            (_row, rowIndex) => rowIndex !== index,
                          ),
                        },
                      }))
                    }
                    disabled={isReportInputDisabled}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <textarea
                className="min-h-[90px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                placeholder="Coverage details"
                value={entry.details}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    staff: {
                      ...current.staff,
                      instructorCovers: current.staff.instructorCovers.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, details: event.target.value } : row,
                      ),
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default StaffSection
