import { SAFETY_CONCERN_TYPES } from '../../../constants'
import { normalizeSafetyConcernType } from '../../../utils/reportData'
import type { ReportSectionProps } from '../types'

function SafetyFacilitySection({
  reportDraft,
  updateReportDraft,
  canEditSelectedReport,
  isReportInputDisabled,
}: ReportSectionProps) {
  return (
    <section className="rounded-2xl border border-secondary/20 bg-bg p-4">
      <h3 className="text-base font-semibold">3) Safety and Facility Observations</h3>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-secondary">Safety concerns (optional)</p>
          {canEditSelectedReport ? (
            <button
              type="button"
              className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
              onClick={() =>
                updateReportDraft(current => ({
                  ...current,
                  safetyFacility: {
                    ...current.safetyFacility,
                    safetyConcerns: [...current.safetyFacility.safetyConcerns, { concernType: 'supervision', description: '' }],
                  },
                }))
              }
              disabled={isReportInputDisabled}
            >
              Add Safety Concern
            </button>
          ) : null}
        </div>
        {reportDraft.safetyFacility.safetyConcerns.length === 0 ? (
          <p className="text-sm text-secondary/70">No safety concerns added.</p>
        ) : (
          reportDraft.safetyFacility.safetyConcerns.map((entry, index) => (
            <div
              key={`safety-${index}`}
              className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-[200px_1fr_auto]"
            >
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={entry.concernType}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    safetyFacility: {
                      ...current.safetyFacility,
                      safetyConcerns: current.safetyFacility.safetyConcerns.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              concernType: normalizeSafetyConcernType(event.target.value),
                            }
                          : row,
                      ),
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              >
                {SAFETY_CONCERN_TYPES.map(option => (
                  <option key={`safety-option-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                placeholder="Brief description"
                value={entry.description}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    safetyFacility: {
                      ...current.safetyFacility,
                      safetyConcerns: current.safetyFacility.safetyConcerns.map((row, rowIndex) =>
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
                      safetyFacility: {
                        ...current.safetyFacility,
                        safetyConcerns: current.safetyFacility.safetyConcerns.filter(
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

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-secondary">Recurring equipment / maintenance issues (optional)</p>
          {canEditSelectedReport ? (
            <button
              type="button"
              className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
              onClick={() =>
                updateReportDraft(current => ({
                  ...current,
                  safetyFacility: {
                    ...current.safetyFacility,
                    maintenanceIssues: [...current.safetyFacility.maintenanceIssues, { item: '', description: '' }],
                  },
                }))
              }
              disabled={isReportInputDisabled}
            >
              Add Issue
            </button>
          ) : null}
        </div>
        {reportDraft.safetyFacility.maintenanceIssues.length === 0 ? (
          <p className="text-sm text-secondary/70">No maintenance issues added.</p>
        ) : (
          reportDraft.safetyFacility.maintenanceIssues.map((entry, index) => (
            <div
              key={`maintenance-${index}`}
              className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3 md:grid-cols-[1fr_2fr_auto]"
            >
              <input
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                type="text"
                placeholder="Equipment / maintenance issue"
                value={entry.item}
                onChange={event =>
                  updateReportDraft(current => ({
                    ...current,
                    safetyFacility: {
                      ...current.safetyFacility,
                      maintenanceIssues: current.safetyFacility.maintenanceIssues.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, item: event.target.value } : row,
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
                    safetyFacility: {
                      ...current.safetyFacility,
                      maintenanceIssues: current.safetyFacility.maintenanceIssues.map((row, rowIndex) =>
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
                      safetyFacility: {
                        ...current.safetyFacility,
                        maintenanceIssues: current.safetyFacility.maintenanceIssues.filter(
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-secondary">Pool deck setup: what works well</p>
            {canEditSelectedReport ? (
              <button
                type="button"
                className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                onClick={() =>
                  updateReportDraft(current => ({
                    ...current,
                    safetyFacility: {
                      ...current.safetyFacility,
                      poolDeckWorksWell: [...current.safetyFacility.poolDeckWorksWell, { item: '', description: '' }],
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              >
                Add Item
              </button>
            ) : null}
          </div>
          {reportDraft.safetyFacility.poolDeckWorksWell.length === 0 ? (
            <p className="text-sm text-secondary/70">No items added.</p>
          ) : (
            reportDraft.safetyFacility.poolDeckWorksWell.map((entry, index) => (
              <div
                key={`works-${index}`}
                className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3"
              >
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="text"
                  placeholder="Item"
                  value={entry.item}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      safetyFacility: {
                        ...current.safetyFacility,
                        poolDeckWorksWell: current.safetyFacility.poolDeckWorksWell.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, item: event.target.value } : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
                <textarea
                  className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  placeholder="Description"
                  value={entry.description}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      safetyFacility: {
                        ...current.safetyFacility,
                        poolDeckWorksWell: current.safetyFacility.poolDeckWorksWell.map((row, rowIndex) =>
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
                        safetyFacility: {
                          ...current.safetyFacility,
                          poolDeckWorksWell: current.safetyFacility.poolDeckWorksWell.filter(
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
            <p className="text-sm font-semibold text-secondary">Pool deck setup: what can improve</p>
            {canEditSelectedReport ? (
              <button
                type="button"
                className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-secondary"
                onClick={() =>
                  updateReportDraft(current => ({
                    ...current,
                    safetyFacility: {
                      ...current.safetyFacility,
                      poolDeckImprovements: [
                        ...current.safetyFacility.poolDeckImprovements,
                        { item: '', description: '' },
                      ],
                    },
                  }))
                }
                disabled={isReportInputDisabled}
              >
                Add Item
              </button>
            ) : null}
          </div>
          {reportDraft.safetyFacility.poolDeckImprovements.length === 0 ? (
            <p className="text-sm text-secondary/70">No items added.</p>
          ) : (
            reportDraft.safetyFacility.poolDeckImprovements.map((entry, index) => (
              <div
                key={`improve-${index}`}
                className="grid gap-3 rounded-2xl border border-secondary/20 bg-accent p-3"
              >
                <input
                  className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="text"
                  placeholder="Item"
                  value={entry.item}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      safetyFacility: {
                        ...current.safetyFacility,
                        poolDeckImprovements: current.safetyFacility.poolDeckImprovements.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, item: event.target.value } : row,
                        ),
                      },
                    }))
                  }
                  disabled={isReportInputDisabled}
                />
                <textarea
                  className="min-h-[80px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  placeholder="Description"
                  value={entry.description}
                  onChange={event =>
                    updateReportDraft(current => ({
                      ...current,
                      safetyFacility: {
                        ...current.safetyFacility,
                        poolDeckImprovements: current.safetyFacility.poolDeckImprovements.map((row, rowIndex) =>
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
                        safetyFacility: {
                          ...current.safetyFacility,
                          poolDeckImprovements: current.safetyFacility.poolDeckImprovements.filter(
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

export default SafetyFacilitySection
