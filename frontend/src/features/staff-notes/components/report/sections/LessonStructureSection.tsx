import type { ReportSectionProps } from '../types'

function LessonStructureSection({
  reportDraft,
  updateReportDraft,
  canEditSelectedReport,
  isReportInputDisabled,
}: ReportSectionProps) {
  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <h3 className="text-base font-semibold">2) Lesson Structure</h3>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm font-semibold text-secondary">Challenging lesson times / layouts</p>
        {reportDraft.lessonStructure.challengingTimes.map((entry, index) => (
          <div
            key={`challenging-${index}`}
            className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-3"
          >
            <input
              className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              type="text"
              placeholder="Time"
              value={entry.time}
              onChange={event =>
                updateReportDraft(current => ({
                  ...current,
                  lessonStructure: {
                    ...current.lessonStructure,
                    challengingTimes: current.lessonStructure.challengingTimes.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, time: event.target.value } : row,
                    ),
                  },
                }))
              }
              disabled={isReportInputDisabled}
            />
            <input
              className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              type="text"
              placeholder="Lessons causing issues"
              value={entry.lessons}
              onChange={event =>
                updateReportDraft(current => ({
                  ...current,
                  lessonStructure: {
                    ...current.lessonStructure,
                    challengingTimes: current.lessonStructure.challengingTimes.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, lessons: event.target.value } : row,
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
                  lessonStructure: {
                    ...current.lessonStructure,
                    challengingTimes: current.lessonStructure.challengingTimes.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, description: event.target.value } : row,
                    ),
                  },
                }))
              }
              disabled={isReportInputDisabled}
            />
          </div>
        ))}
        {canEditSelectedReport && reportDraft.lessonStructure.challengingTimes.length > 1 ? (
          <p className="text-xs font-semibold text-secondary/70">Keep at least one challenging lesson entry.</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-secondary">New class layouts (optional)</p>
          {canEditSelectedReport ? (
            <button
              type="button"
              className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
              onClick={() =>
                updateReportDraft(current => ({
                  ...current,
                  lessonStructure: {
                    ...current.lessonStructure,
                    newClassLayouts: [...current.lessonStructure.newClassLayouts, { level: '', description: '' }],
                  },
                }))
              }
              disabled={isReportInputDisabled}
            >
              Add Layout
            </button>
          ) : null}
        </div>
        {reportDraft.lessonStructure.newClassLayouts.length === 0 ? (
          <p className="text-sm text-secondary/70">No new class layouts added.</p>
        ) : (
          reportDraft.lessonStructure.newClassLayouts.map((entry, index) => (
            <div
              key={`layout-${index}`}
              className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-[1fr_2fr_auto]"
            >
              <input
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                type="text"
                placeholder="Level"
                value={entry.level}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    lessonStructure: {
                      ...current.lessonStructure,
                      newClassLayouts: current.lessonStructure.newClassLayouts.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, level: event.target.value } : row,
                      ),
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              />
              <textarea
                className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                placeholder="Layout / location description"
                value={entry.description}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    lessonStructure: {
                      ...current.lessonStructure,
                      newClassLayouts: current.lessonStructure.newClassLayouts.map((row, rowIndex) =>
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
                  className="rounded-2xl bg-danger px-3 py-2 text-xs font-semibold text-accent transition hover:bg-dangerHover"
                  onClick={() =>
                    updateReportDraft(current => ({
                      ...current,
                      lessonStructure: {
                        ...current.lessonStructure,
                        newClassLayouts: current.lessonStructure.newClassLayouts.filter(
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
    </section>
  )
}

export default LessonStructureSection
