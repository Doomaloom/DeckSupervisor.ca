const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

type PdfViewerResult = {
  pdfWindow: Window
}

const renderPdfViewer = (pdfWindow: Window, blobUrl: string, title: string) => {
  const safeTitle = escapeHtml(title)
  pdfWindow.document.open()
  pdfWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #f5f5f5;
      }
      .viewer-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .viewer-bar {
        flex: 0 0 auto;
        padding: 10px 14px;
        font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2937;
        background: #ffffff;
        border-bottom: 1px solid #d1d5db;
      }
      .viewer-frame {
        flex: 1 1 auto;
        width: 100%;
        border: 0;
        background: #525252;
      }
    </style>
  </head>
  <body>
    <div class="viewer-shell">
      <div class="viewer-bar">${safeTitle}</div>
      <iframe class="viewer-frame" src="${blobUrl}" title="${safeTitle}"></iframe>
    </div>
  </body>
</html>`)
  pdfWindow.document.close()
}

const mountPdfViewer = (
  pdfBlob: Blob,
  existingWindow?: Window | null,
  title = 'Print PDF',
): PdfViewerResult | null => {
  const blobUrl = window.URL.createObjectURL(pdfBlob)
  const pdfWindow = existingWindow ?? window.open('', '_blank')

  if (!pdfWindow) {
    window.URL.revokeObjectURL(blobUrl)
    return null
  }

  renderPdfViewer(pdfWindow, blobUrl, title)
  const cleanup = () => {
    window.URL.revokeObjectURL(blobUrl)
  }
  pdfWindow.addEventListener('beforeunload', cleanup, { once: true })

  return {
    pdfWindow,
  }
}

export function openPrintWindow(title = 'Preparing PDF') {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    return null
  }

  printWindow.document.open()
  printWindow.document.write(
    `<title>${escapeHtml(title)}</title><p style="font-family: sans-serif;">Preparing PDF...</p>`,
  )
  printWindow.document.close()
  return printWindow
}

export function openPdfPrintDialog(
  pdfBlob: Blob,
  existingWindow?: Window | null,
  title = 'Print PDF',
) {
  const viewer = mountPdfViewer(pdfBlob, existingWindow, title)
  if (!viewer) {
    return false
  }

  const triggerPrint = () => {
    viewer.pdfWindow.focus()
    viewer.pdfWindow.print()
  }

  viewer.pdfWindow.onload = () => {
    setTimeout(triggerPrint, 1000)
  }

  setTimeout(triggerPrint, 3000)
  return true
}

export function openPdfPreview(pdfBlob: Blob, title = 'Open PDF') {
  return Boolean(mountPdfViewer(pdfBlob, undefined, title))
}

export function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl)
  }, 1000)
}
