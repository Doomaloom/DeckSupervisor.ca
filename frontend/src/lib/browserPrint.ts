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

type PdfWindowOptions = {
  title?: string
  filename?: string
}

type PdfViewerWindow = Window & {
  __printEmbeddedPdf?: () => boolean
}

const normalizePdfWindowOptions = (
  options: PdfWindowOptions | string | undefined,
  fallbackTitle: string,
): Required<PdfWindowOptions> => {
  if (typeof options === 'string') {
    return {
      title: options,
      filename: '',
    }
  }

  return {
    title: options?.title?.trim() || fallbackTitle,
    filename: options?.filename?.trim() || '',
  }
}

const createPdfSource = (pdfBlob: Blob, filename: string) => {
  if (!filename || typeof File === 'undefined') {
    return pdfBlob
  }
  return new File([pdfBlob], filename, {
    type: pdfBlob.type || 'application/pdf',
  })
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2937;
        background: #ffffff;
        border-bottom: 1px solid #d1d5db;
      }
      .viewer-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .viewer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }
      .viewer-status {
        display: none;
        font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #6b7280;
      }
      .viewer-status[data-visible="true"] {
        display: block;
      }
      .viewer-button {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #1f2937;
        border-radius: 999px;
        padding: 6px 12px;
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      .viewer-button:hover {
        background: #f9fafb;
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
      <div class="viewer-bar">
        <div class="viewer-title">${safeTitle}</div>
        <div class="viewer-actions">
          <div id="viewer-status" class="viewer-status" aria-live="polite"></div>
          <button id="viewer-print-button" type="button" class="viewer-button">Print PDF</button>
        </div>
      </div>
      <iframe id="pdf-viewer-frame" class="viewer-frame" src="${blobUrl}" title="${safeTitle}"></iframe>
    </div>
    <script>
      (function () {
        const iframe = document.getElementById('pdf-viewer-frame');
        const status = document.getElementById('viewer-status');
        const setStatus = message => {
          if (!status) {
            return;
          }
          status.textContent = message;
          status.setAttribute('data-visible', message ? 'true' : 'false');
        };

        window.__printEmbeddedPdf = function () {
          try {
            const target = iframe && iframe.contentWindow;
            if (!target) {
              setStatus('Print did not open. Use the browser PDF controls to print manually.');
              return false;
            }
            setStatus('');
            target.focus();
            target.print();
            return true;
          } catch (error) {
            console.error('Failed to print embedded PDF', error);
            setStatus('Print did not open. Use the browser PDF controls to print manually.');
            return false;
          }
        };

        const printButton = document.getElementById('viewer-print-button');
        if (printButton) {
          printButton.addEventListener('click', function () {
            window.__printEmbeddedPdf();
          });
        }
      }());
    </script>
  </body>
</html>`)
  pdfWindow.document.close()
}

const mountPdfViewer = (
  pdfBlob: Blob,
  existingWindow?: Window | null,
  options?: PdfWindowOptions | string,
  fallbackTitle = 'Print PDF',
): PdfViewerResult | null => {
  const normalizedOptions = normalizePdfWindowOptions(options, fallbackTitle)
  const source = createPdfSource(pdfBlob, normalizedOptions.filename)
  const blobUrl = window.URL.createObjectURL(source)
  const pdfWindow = existingWindow ?? window.open('', '_blank')

  if (!pdfWindow) {
    window.URL.revokeObjectURL(blobUrl)
    return null
  }

  renderPdfViewer(pdfWindow, blobUrl, normalizedOptions.title)
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
  options?: PdfWindowOptions | string,
) {
  const viewer = mountPdfViewer(pdfBlob, existingWindow, options)
  if (!viewer) {
    return false
  }

  const triggerPrint = () => {
    const targetWindow = viewer.pdfWindow as PdfViewerWindow
    targetWindow.focus()
    targetWindow.__printEmbeddedPdf?.()
  }

  viewer.pdfWindow.onload = () => {
    setTimeout(triggerPrint, 1000)
  }

  setTimeout(triggerPrint, 3000)
  return true
}

export function openPdfPreview(pdfBlob: Blob, options?: PdfWindowOptions | string) {
  return Boolean(mountPdfViewer(pdfBlob, undefined, options, 'Open PDF'))
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
