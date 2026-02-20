import { PARENT_FEEDBACK_TYPES } from '../../../constants'
import { normalizeParentFeedbackType } from '../../../utils/reportData'
import type { ReportSectionProps } from '../types'

function ParentFeedbackSection({
  reportDraft,
  updateReportDraft,
  canEditSelectedReport,
  isReportInputDisabled,
}: ReportSectionProps) {
  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">4) Parent / Customer Feedback</h3>
        {canEditSelectedReport ? (
          <button
            type="button"
            className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
            onClick={() =>
              updateReportDraft(current => ({
                ...current,
                parentCustomerFeedback: [
                  ...current.parentCustomerFeedback,
                  { feedbackType: 'comment', description: '' },
                ],
              }))
            }
            disabled={isReportInputDisabled}
          >
            Add Feedback
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {reportDraft.parentCustomerFeedback.length === 0 ? (
          <p className="text-sm text-secondary/70">No parent/customer feedback added.</p>
        ) : (
          reportDraft.parentCustomerFeedback.map((entry, index) => (
            <div
              key={`feedback-${index}`}
              className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-[180px_1fr_auto]"
            >
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={entry.feedbackType}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    parentCustomerFeedback: current.parentCustomerFeedback.map((row, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...row,
                            feedbackType: normalizeParentFeedbackType(event.target.value),
                          }
                        : row,
                    ),
                  }))
                }
                disabled={isReportInputDisabled}
              >
                {PARENT_FEEDBACK_TYPES.map(option => (
                  <option key={`feedback-option-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                placeholder="Description"
                value={entry.description}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    parentCustomerFeedback: current.parentCustomerFeedback.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, description: event.target.value } : row,
                    ),
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
                      parentCustomerFeedback: current.parentCustomerFeedback.filter(
                        (_row, rowIndex) => rowIndex !== index,
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
    </section>
  )
}

export default ParentFeedbackSection
