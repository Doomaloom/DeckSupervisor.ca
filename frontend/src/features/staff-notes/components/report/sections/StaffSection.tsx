import type { ReportSectionProps } from '../types'

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
  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <h3 className="text-base font-semibold">1) Staff</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
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
          <p className="text-sm font-semibold text-secondary">Strength / Weakness (per instructor)</p>
          {reportDraft.staff.strengthWeakness.length === 0 ? (
            <p className="text-sm text-secondary/70">No instructors found for this session.</p>
          ) : (
            reportDraft.staff.strengthWeakness.map((entry, index) => (
              <label key={`${entry.instructor}-strength-${index}`} className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">{entry.instructor}</span>
                <textarea
                  className="min-h-[90px] rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-sm text-secondary"
                  value={entry.text}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      staff: {
                        ...current.staff,
                        strengthWeakness: current.staff.strengthWeakness.map((row, rowIndex) =>
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
      </div>

      <label className="mt-4 flex flex-col gap-2">
        <span className="text-sm font-semibold text-secondary">
          Succession plans (certifications, supervisor path, etc.)
        </span>
        <textarea
          className="min-h-[100px] rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-sm text-secondary"
          value={reportDraft.staff.successionPlans}
          onChange={event =>
            updateReportDraft(current => ({
              ...current,
              staff: {
                ...current.staff,
                successionPlans: event.target.value,
              },
            }))
          }
          disabled={isReportInputDisabled}
        />
      </label>

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
