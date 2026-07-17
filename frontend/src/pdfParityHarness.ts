import { generateAttendancePdf } from './features/pdf'
import { attendanceVisualFixtures } from './features/pdf/pdfVisualFixtures'

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

const api = {
  names: Object.keys(attendanceVisualFixtures),
  async render(name: string) {
    const request = attendanceVisualFixtures[name]
    if (!request) throw new Error(`Unknown PDF fixture: ${name}`)
    const startedAt = performance.now()
    const artifact = await generateAttendancePdf(request)
    const bytes = new Uint8Array(await artifact.blob.arrayBuffer())
    return { name, filename: artifact.filename, base64: bytesToBase64(bytes), durationMs: Math.round(performance.now() - startedAt) }
  },
}

declare global { interface Window { pdfParity: typeof api } }
window.pdfParity = api

const select = document.querySelector<HTMLSelectElement>('#fixture')!
const button = document.querySelector<HTMLButtonElement>('#render')!
const status = document.querySelector<HTMLElement>('#status')!
const preview = document.querySelector<HTMLIFrameElement>('#preview')!
api.names.forEach(name => select.add(new Option(name, name)))
let previewUrl = ''
button.addEventListener('click', async () => {
  status.textContent = ' Rendering…'
  button.disabled = true
  try {
    const result = await api.render(select.value)
    const bytes = Uint8Array.from(atob(result.base64), character => character.charCodeAt(0))
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    preview.src = previewUrl
    status.textContent = ` Rendered in ${result.durationMs} ms`
  } catch (error) {
    status.textContent = ` ${error instanceof Error ? error.message : String(error)}`
  } finally {
    button.disabled = false
  }
})
