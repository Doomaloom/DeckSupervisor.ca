import type { PreparedAttendanceGroup } from './legacyAttendanceDom'

let captureTail: Promise<void> = Promise.resolve()
async function withCaptureLock<T>(operation: () => Promise<T>) {
  const previous = captureTail; let release = () => {}
  captureTail = new Promise<void>(resolve => { release = resolve }); await previous
  try { return await operation() } finally { release() }
}
function assertCaptureSupport() {
  if (typeof SVGForeignObjectElement === 'undefined' || typeof HTMLCanvasElement.prototype.toBlob !== 'function' || !('fonts' in document)) throw new Error('Attendance PDF generation requires a current version of Chrome or Edge.')
}
function captureInFrame(iframe: HTMLIFrameElement, group: PreparedAttendanceGroup) {
  return new Promise<[Blob, Blob]>((resolve, reject) => {
    const id = crypto.randomUUID(); const started = Date.now()
    const cleanup = () => { window.removeEventListener('message', onMessage); window.clearInterval(timer) }
    const fail = (error: Error) => { cleanup(); reject(error) }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      if (event.data?.type === 'attendance-capture-ready') iframe.contentWindow?.postMessage({ type:'attendance-capture-request', id, group }, location.origin)
      if (event.data?.type === 'attendance-capture-result' && event.data.id === id) { cleanup(); resolve(event.data.blobs) }
      if (event.data?.type === 'attendance-capture-error' && event.data.id === id) fail(new Error(event.data.message))
    }
    window.addEventListener('message', onMessage)
    const timer = window.setInterval(() => { if (Date.now() - started > 70_000) fail(new Error('Attendance capture frame timed out.')) }, 250)
  })
}
export async function captureLegacyAttendanceGroup(group: PreparedAttendanceGroup) {
  assertCaptureSupport()
  return withCaptureLock(async () => {
    const iframe = document.createElement('iframe'); iframe.sandbox.add('allow-scripts', 'allow-same-origin'); iframe.setAttribute('aria-hidden','true')
    iframe.src = new URL('attendance-capture.html', document.baseURI).toString(); Object.assign(iframe.style,{position:'fixed',left:'-12000px',top:'0',width:'1056px',height:'816px',border:'0',opacity:'0',pointerEvents:'none'})
    const result = captureInFrame(iframe, group); document.body.append(iframe)
    try { return await result }
    catch(error){if(error instanceof Error&&error.message.includes('Attendance'))throw error;throw new Error(`Attendance PDF capture failed: ${error instanceof Error?error.message:String(error)}`)}
    finally{iframe.remove()}
  })
}
export { computeAttendanceContentScale } from './attendanceCaptureConstants'
