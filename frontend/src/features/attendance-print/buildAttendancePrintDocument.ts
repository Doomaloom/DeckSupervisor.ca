import compatibilityCss from './attendanceCompatibility.css?inline'
import sansRegular from '../pdf/fonts/LiberationSans-Regular.ttf?url'
import sansBold from '../pdf/fonts/LiberationSans-Bold.ttf?url'
import serifRegular from '../pdf/fonts/LiberationSerif-Regular.ttf?url'
import serifBold from '../pdf/fonts/LiberationSerif-Bold.ttf?url'
import { loadAttendanceTemplate } from './templateRegistry'
import { extractAttendanceTemplateSections, fillAttendanceRoster } from './templateDom'
import { buildSchematicCoverElement } from './schematicCover'
import type { AttendancePrintItem, AttendancePrintOptions, AttendancePrintRequest } from './types'

export function groupAttendancePrintItems(items: AttendancePrintItem[]) {
  const groups: AttendancePrintItem[][] = []
  for (let index = 0; index < items.length;) {
    const next = items[index + 1]
    if (next && next.roster.code === items[index].roster.code) {
      groups.push([items[index], next])
      index += 2
    } else {
      groups.push([items[index]])
      index += 1
    }
  }
  return groups
}

function requestItems(request: AttendancePrintRequest) {
  if (request.rosters?.length) return request.rosters
  if (request.roster) return [{ template: request.template?.trim() || 'SplashFitness', roster: request.roster }]
  throw new Error('No attendance rosters were provided.')
}

function fontCss() {
  return `
@font-face { font-family: Arial; src: url("${sansRegular}"); font-weight: 400; }
@font-face { font-family: Arial; src: url("${sansBold}"); font-weight: 700; }
@font-face { font-family: "Liberation Serif"; src: url("${serifRegular}"); font-weight: 400; }
@font-face { font-family: "Liberation Serif"; src: url("${serifBold}"); font-weight: 700; }
body { font-family: "Liberation Serif", serif; }
`
}

function printPage(document: Document, kind: string) {
  const page = document.createElement('section')
  page.className = 'print-page'
  page.dataset.pageKind = kind
  return page
}

function adjacentInstructorPackets(items: AttendancePrintItem[]) {
  const packets: AttendancePrintItem[][] = []
  items.forEach(item => {
    const current = packets.at(-1)
    if (current?.[0].roster.instructor === item.roster.instructor) current.push(item)
    else packets.push([item])
  })
  return packets
}

export async function buildAttendancePrintDocument(
  request: AttendancePrintRequest,
  options: AttendancePrintOptions = {},
): Promise<Document> {
  const items = requestItems(request)
  const document = window.document.implementation.createHTMLDocument(request.title?.trim() || 'Attendance Sheets')
  document.documentElement.lang = 'en'
  const meta = document.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  meta.content = "default-src 'self' data: blob:; script-src 'none'; style-src 'unsafe-inline'; font-src 'self' data: blob:"
  document.head.append(meta)
  const style = document.createElement('style')
  style.textContent = `${fontCss()}\n${compatibilityCss}`
  document.head.append(style)
  document.body.className = 'attendance-print-document'

  const loaded = await Promise.all(items.map(async item => {
    const template = await loadAttendanceTemplate(item.template)
    return { item, sections: extractAttendanceTemplateSections(template.key, template.html) }
  }))
  const templateStyles = new Set(loaded.flatMap(entry => entry.sections.styles))
  templateStyles.forEach(css => {
    const templateStyle = document.createElement('style')
    templateStyle.textContent = css
    document.head.append(templateStyle)
  })

  const byItem = new Map(items.map((item, index) => [item, loaded[index].sections]))
  const packets = options.schematicCover ? adjacentInstructorPackets(items) : [items]
  for (const packet of packets) {
    if (options.schematicCover) {
      const instructor = packet[0]?.roster.instructor ?? ''
      const coverRequest = {
        ...options.schematicCover.request,
        ...(options.schematicCover.highlightEachInstructor
          ? { highlightInstructor: true, selectedInstructor: instructor }
          : {}),
      }
      const cover = printPage(document, 'schematic-cover')
      cover.append(buildSchematicCoverElement(document, coverRequest))
      document.body.append(cover)
      if (options.schematicCover.blankBack !== false) document.body.append(printPage(document, 'blank'))
    }
    for (const group of groupAttendancePrintItems(packet)) {
      const paired = group.length === 2
      for (const side of ['front', 'back'] as const) {
        const page = printPage(document, `attendance-${side}`)
        if (paired) page.classList.add('combined-page')
        for (const item of group) {
          const sections = byItem.get(item)
          if (!sections) continue
          const source = side === 'front' ? sections.frontFragment : sections.backFragment
          const fragment = document.importNode(source, true)
          fillAttendanceRoster(fragment, item.roster, request.session?.trim() || 'Session')
          if (paired) {
            const slot = document.createElement('div')
            slot.className = 'combined-slot'
            slot.append(fragment)
            page.append(slot)
          } else {
            page.append(fragment)
          }
        }
        document.body.append(page)
      }
    }
  }
  return document
}
