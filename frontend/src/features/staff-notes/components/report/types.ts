import type { ReportItem, SessionReportData } from '../../types'

export type UpdateReportDraft = (
  updater: (current: SessionReportData) => SessionReportData,
) => void

export type ReportSectionProps = {
  reportDraft: SessionReportData
  updateReportDraft: UpdateReportDraft
  canEditSelectedReport: boolean
  isReportInputDisabled: boolean
}

export type ReportTabProps = {
  isSessionReady: boolean
  reports: ReportItem[]
  activeReportId: string
  onSelectReport: (id: string) => void
  canCreateReports: boolean
  onCreateReport: () => void
  selectedReport: ReportItem | null
  canEditSelectedReport: boolean
  onDeleteReport: () => void
  onExportReport: () => void
  isExportingReport: boolean
  reportStatus: string
  reportTitle: string
  onReportTitleChange: (value: string) => void
  isReportInputDisabled: boolean
  listEmptyLabel: string
  reportDraft: SessionReportData
  updateReportDraft: UpdateReportDraft
  reportInstructorOptions: string[]
}
