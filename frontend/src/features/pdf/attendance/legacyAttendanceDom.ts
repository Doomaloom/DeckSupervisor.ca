import type { AttendancePdfItem, AttendancePdfRoster } from '../types'
import { loadLegacyAttendanceTemplate } from './legacyAttendanceTemplates'

export type PreparedAttendancePage = {
  kind: 'front' | 'back'
  templateKeys: string[]
  html: string
}

export type PreparedAttendanceGroup = {
  headHtml: string
  bodyAttributes: Array<[string, string]>
  pages: [PreparedAttendancePage, PreparedAttendancePage]
}

function setText(root: ParentNode, id: string, value: string) {
  const element = root.querySelector<HTMLElement>(`#${id}`)
  if (element) element.textContent = value
}

function appendAttendanceLegend(cell: HTMLTableCellElement) {
  const document = cell.ownerDocument
  const font = document.createElement('font')
  font.append(document.createElement('br'))
  const absence = document.createElement('span')
  absence.style.textDecoration = 'underline'
  absence.textContent = 'A'
  font.append(absence, document.createTextNode('bsent/'))
  const present = document.createElement('span')
  present.style.textDecoration = 'underline'
  present.textContent = 'P'
  font.append(present, document.createTextNode('resent'), document.createElement('br'))
  const days = document.createElement('span')
  days.style.color = 'rgb(98, 98, 98)'
  days.style.fontSize = '11px'
  days.textContent = Array.from({ length: 14 }, (_, index) => `[Day ${index + 1}]`).join(' ')
  font.append(days)
  cell.append(font)
}

export function fillLegacyAttendanceRoster(root: ParentNode, roster: AttendancePdfRoster, session: string) {
  const schedule = roster.schedule || ''
  const startDate = schedule.split(/\s+/)[1] || ''
  setText(root, 'instructor', roster.instructor || '')
  setText(root, 'start_time', [startDate, roster.time || ''].filter(Boolean).join(' ').trim())
  setText(root, 'session', session)
  setText(root, 'location', roster.location || '')
  setText(root, 'barcode', roster.code || '')

  const tbody = root.querySelector<HTMLTableSectionElement>('#attendance-rows')
  const templateRow = root.querySelector<HTMLTableRowElement>('#student-rows')
  if (!tbody || !templateRow) throw new Error('Attendance template is missing its student table.')
  const emptyCellCount = Math.max(templateRow.children.length - 1, 0)
  Array.from(tbody.querySelectorAll(':scope > tr')).forEach(row => {
    if (row !== templateRow) row.remove()
  })

  roster.students.forEach((student, index) => {
    const row = tbody.ownerDocument.createElement('tr')
    const nameCell = tbody.ownerDocument.createElement('td')
    const name = tbody.ownerDocument.createElement('strong')
    name.style.fontFamily = 'Arial'
    name.textContent = `${index + 1}. ${student.name || ''}`
    nameCell.append(name)
    appendAttendanceLegend(nameCell)
    row.append(nameCell)
    for (let cellIndex = 0; cellIndex < emptyCellCount; cellIndex += 1) {
      const cell = tbody.ownerDocument.createElement('td')
      cell.append('\u00a0')
      row.append(cell)
    }
    tbody.append(row)
  })
}

export function parseLegacyAttendanceTemplate(html: string, roster: AttendancePdfRoster, session: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script').forEach(script => script.remove())
  fillLegacyAttendanceRoster(document, roster, session)
  return document
}

function splitTemplatePage(document: Document) {
  const source = document.querySelector<HTMLElement>('.templatePage')
  if (!source) throw new Error('Attendance template is missing .templatePage.')
  const front = source.cloneNode(true) as HTMLElement
  const back = source.cloneNode(true) as HTMLElement
  const frontBreak = front.querySelector<HTMLElement>('.break-before-page')
  const backBreak = back.querySelector<HTMLElement>('.break-before-page')
  if (!frontBreak || !backBreak) throw new Error('Attendance template is missing its front/back boundary.')

  let node: Element | null = frontBreak
  while (node) {
    const next: Element | null = node.nextElementSibling
    node.remove()
    node = next
  }
  node = back.firstElementChild
  while (node) {
    const next: Element | null = node.nextElementSibling
    node.remove()
    if (node === backBreak) break
    node = next
  }
  return { front, back }
}

function bodyAttributes(document: Document): Array<[string, string]> {
  return Array.from(document.body.attributes, attribute => [attribute.name, attribute.value])
}

function combinedPage(fragments: HTMLElement[], indexes: number[]) {
  return fragments.map((fragment, index) =>
    `<div class="combined-slot" data-attendance-root="${indexes[index]}">${fragment.outerHTML}</div>`,
  ).join('\n')
}

export async function prepareLegacyAttendanceGroup(items: AttendancePdfItem[], session: string): Promise<PreparedAttendanceGroup> {
  if (items.length < 1 || items.length > 2) throw new Error('Attendance groups must contain one or two rosters.')
  const loaded = await Promise.all(items.map(item => loadLegacyAttendanceTemplate(item.template)))
  const parsed = loaded.map(({ html }, index) => parseLegacyAttendanceTemplate(html, items[index].roster, session))
  const fragments = parsed.map(splitTemplatePage)
  const indexes = items.map((_, index) => index)
  return {
    headHtml: parsed[0].head.innerHTML,
    bodyAttributes: bodyAttributes(parsed[0]),
    pages: [
      { kind: 'front', templateKeys: loaded.map(entry => entry.key), html: combinedPage(fragments.map(entry => entry.front), indexes) },
      { kind: 'back', templateKeys: loaded.map(entry => entry.key), html: combinedPage(fragments.map(entry => entry.back), indexes) },
    ],
  }
}
