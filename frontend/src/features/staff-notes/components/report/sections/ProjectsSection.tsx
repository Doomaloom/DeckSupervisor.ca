import type { ReportSectionProps } from '../types'

function ProjectsSection({
  reportDraft,
  updateReportDraft,
  canEditSelectedReport,
  isReportInputDisabled,
}: ReportSectionProps) {
  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <h3 className="text-base font-semibold">5) Projects and/or Initiatives</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-secondary">Admin work</p>
            {canEditSelectedReport ? (
              <button
                type="button"
                className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                onClick={() =>
                  updateReportDraft(current => ({
                    ...current,
                    projectsInitiatives: {
                      ...current.projectsInitiatives,
                      adminWork: [...current.projectsInitiatives.adminWork, { work: '', description: '' }],
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              >
                Add Admin Work
              </button>
            ) : null}
          </div>
          {reportDraft.projectsInitiatives.adminWork.length === 0 ? (
            <p className="text-sm text-secondary/70">No admin work entries added.</p>
          ) : (
            reportDraft.projectsInitiatives.adminWork.map((entry, index) => (
              <div key={`admin-${index}`} className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3">
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="text"
                  placeholder="What was done"
                  value={entry.work}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      projectsInitiatives: {
                        ...current.projectsInitiatives,
                        adminWork: current.projectsInitiatives.adminWork.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, work: event.target.value } : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
                <textarea
                  className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  placeholder="Brief description"
                  value={entry.description}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      projectsInitiatives: {
                        ...current.projectsInitiatives,
                        adminWork: current.projectsInitiatives.adminWork.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, description: event.target.value } : row,
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
                        projectsInitiatives: {
                          ...current.projectsInitiatives,
                          adminWork: current.projectsInitiatives.adminWork.filter(
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
            ))
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-secondary">Projects to initiate</p>
            {canEditSelectedReport ? (
              <button
                type="button"
                className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                onClick={() =>
                  updateReportDraft(current => ({
                    ...current,
                    projectsInitiatives: {
                      ...current.projectsInitiatives,
                      initiatives: [...current.projectsInitiatives.initiatives, { title: '', brief: '' }],
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              >
                Add Initiative
              </button>
            ) : null}
          </div>
          {reportDraft.projectsInitiatives.initiatives.length === 0 ? (
            <p className="text-sm text-secondary/70">No initiatives added.</p>
          ) : (
            reportDraft.projectsInitiatives.initiatives.map((entry, index) => (
              <div
                key={`initiative-${index}`}
                className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3"
              >
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="text"
                  placeholder="Initiative title"
                  value={entry.title}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      projectsInitiatives: {
                        ...current.projectsInitiatives,
                        initiatives: current.projectsInitiatives.initiatives.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, title: event.target.value } : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
                <textarea
                  className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  placeholder="Brief description"
                  value={entry.brief}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      projectsInitiatives: {
                        ...current.projectsInitiatives,
                        initiatives: current.projectsInitiatives.initiatives.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, brief: event.target.value } : row,
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
                        projectsInitiatives: {
                          ...current.projectsInitiatives,
                          initiatives: current.projectsInitiatives.initiatives.filter(
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
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default ProjectsSection
