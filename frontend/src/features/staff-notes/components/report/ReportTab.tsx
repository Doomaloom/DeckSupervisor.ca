import LessonStructureSection from './sections/LessonStructureSection'
import ParentFeedbackSection from './sections/ParentFeedbackSection'
import ProjectsSection from './sections/ProjectsSection'
import SafetyFacilitySection from './sections/SafetyFacilitySection'
import StaffSection from './sections/StaffSection'
import type { ReportTabProps } from './types'

function ReportTab({
  isSessionReady,
  reports,
  activeReportId,
  onSelectReport,
  canCreateReports,
  onCreateReport,
  selectedReport,
  canEditSelectedReport,
  onDeleteReport,
  reportStatus,
  reportTitle,
  onReportTitleChange,
  isReportInputDisabled,
  listEmptyLabel,
  reportDraft,
  updateReportDraft,
  reportInstructorOptions,
}: ReportTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-secondary/20 bg-bg p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={activeReportId}
            onChange={event => onSelectReport(event.target.value)}
            disabled={!isSessionReady || reports.length === 0}
          >
            {reports.length === 0 ? <option value="">No reports available</option> : null}
            {reports.map(report => (
              <option key={report.id} value={report.id}>
                {report.title || 'Untitled report'} - {new Date(report.updatedAt).toLocaleString()}
              </option>
            ))}
          </select>
          {canCreateReports ? (
            <button
              type="button"
              className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onCreateReport}
              disabled={!isSessionReady}
            >
              Create New Report
            </button>
          ) : null}
          {selectedReport && canEditSelectedReport ? (
            <button
              type="button"
              className="rounded-2xl bg-danger px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-dangerHover"
              onClick={onDeleteReport}
              disabled={!isSessionReady}
            >
              Delete Report
            </button>
          ) : null}
        </div>
        {reportStatus ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">{reportStatus}</p>
        ) : null}
        {selectedReport ? (
          <>
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Report Title
              <input
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                type="text"
                value={reportTitle}
                onChange={event => onReportTitleChange(event.target.value)}
                disabled={isReportInputDisabled}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">
                Created: {new Date(selectedReport.createdAt).toLocaleString()}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">
                Last updated: {new Date(selectedReport.updatedAt).toLocaleString()}
              </p>
              {selectedReport.authorName ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">
                  Author: {selectedReport.authorName}
                </p>
              ) : null}
              {selectedReport.sessionContext ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">
                  Session: {selectedReport.sessionContext}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-secondary/70">{listEmptyLabel}</p>
        )}
      </div>

      {selectedReport ? (
        <div className="flex flex-col gap-4">
          {!canEditSelectedReport ? (
            <p className="text-sm font-semibold text-secondary/70">
              This report is read-only for your current access level.
            </p>
          ) : null}

          <StaffSection
            reportDraft={reportDraft}
            updateReportDraft={updateReportDraft}
            canEditSelectedReport={canEditSelectedReport}
            isReportInputDisabled={isReportInputDisabled}
            reportInstructorOptions={reportInstructorOptions}
          />
          <LessonStructureSection
            reportDraft={reportDraft}
            updateReportDraft={updateReportDraft}
            canEditSelectedReport={canEditSelectedReport}
            isReportInputDisabled={isReportInputDisabled}
          />
          <SafetyFacilitySection
            reportDraft={reportDraft}
            updateReportDraft={updateReportDraft}
            canEditSelectedReport={canEditSelectedReport}
            isReportInputDisabled={isReportInputDisabled}
          />
          <ParentFeedbackSection
            reportDraft={reportDraft}
            updateReportDraft={updateReportDraft}
            canEditSelectedReport={canEditSelectedReport}
            isReportInputDisabled={isReportInputDisabled}
          />
          <ProjectsSection
            reportDraft={reportDraft}
            updateReportDraft={updateReportDraft}
            canEditSelectedReport={canEditSelectedReport}
            isReportInputDisabled={isReportInputDisabled}
          />
        </div>
      ) : null}
    </div>
  )
}

export default ReportTab
