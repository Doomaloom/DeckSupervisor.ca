import React from 'react'
import { downloadBlob, openPdfPreview } from '../lib/browserPrint'

type PrintPopupBlockedNoticeProps = {
  jobLabel: string
  pdfBlob?: Blob | null
  filename?: string
  onRetry: () => void
  onDismiss?: () => void
}

function PrintPopupBlockedNotice({
  jobLabel,
  pdfBlob,
  filename,
  onRetry,
  onDismiss,
}: PrintPopupBlockedNoticeProps) {
  const handleOpenPdf = () => {
    if (!pdfBlob) {
      return
    }
    if (!openPdfPreview(pdfBlob, { title: jobLabel, filename }) && filename) {
      downloadBlob(pdfBlob, filename)
    }
  }

  const handleDownloadPdf = () => {
    if (!pdfBlob || !filename) {
      return
    }
    downloadBlob(pdfBlob, filename)
  }

  return (
    <div className="rounded-card border-2 border-danger/30 bg-danger/10 p-4 text-secondary shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-danger">Browser blocked the print window.</p>
          <p className="mt-1 text-sm text-secondary">
            Allow pop-ups for this site and retry printing. You can also open or download the PDF
            and print it manually from the browser viewer.
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="rounded-2xl border border-secondary/30 px-3 py-1 text-xs font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
          onClick={onRetry}
        >
          Retry Print
        </button>
        {pdfBlob ? (
          <button
            type="button"
            className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
            onClick={handleOpenPdf}
          >
            Open PDF
          </button>
        ) : null}
        {pdfBlob && filename ? (
          <button
            type="button"
            className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
            onClick={handleDownloadPdf}
          >
            Download PDF
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default PrintPopupBlockedNotice
