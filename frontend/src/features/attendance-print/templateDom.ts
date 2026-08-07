import type {
  AttendancePrintRoster,
  AttendanceTemplateSections,
} from './types'

const REQUIRED_PLACEHOLDERS = ['instructor', 'start_time', 'session', 'location', 'barcode'] as const

function copyAttributes(element: Element) {
  return Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]))
}

function clonePageFragment(page: Element, nodes: Node[]) {
  const clone = page.cloneNode(false) as HTMLElement
  nodes.forEach(node => clone.appendChild(node.cloneNode(true)))
  return clone
}

export function extractAttendanceTemplateSections(key: string, html: string): AttendanceTemplateSections {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.querySelectorAll('script, link[href]').forEach(element => element.remove())
  const page = parsed.querySelector('.templatePage')
  const boundary = page?.querySelector(':scope > .break-before-page')
  if (!page || !boundary) throw new Error(`Attendance template ${key} is missing its front/back boundary.`)

  const nodes = Array.from(page.childNodes)
  const boundaryIndex = nodes.indexOf(boundary)
  const frontFragment = clonePageFragment(page, nodes.slice(0, boundaryIndex))
  const backFragment = clonePageFragment(page, nodes.slice(boundaryIndex + 1))
  const combinedText = `${frontFragment.textContent ?? ''}${backFragment.textContent ?? ''}`
  if (!combinedText.trim()) throw new Error(`Attendance template ${key} is empty.`)

  REQUIRED_PLACEHOLDERS.forEach(id => {
    if (!frontFragment.querySelector(`#${id}`)) throw new Error(`Attendance template ${key} is missing #${id}.`)
  })
  if (!frontFragment.querySelector('#attendance-rows') || !frontFragment.querySelector('#student-rows')) {
    throw new Error(`Attendance template ${key} is missing its attendance row elements.`)
  }

  return {
    key,
    styles: Array.from(parsed.head.querySelectorAll('style')).map(style => style.textContent ?? ''),
    pageAttributes: copyAttributes(page),
    frontFragment,
    backFragment,
  }
}

function setText(root: ParentNode, id: string, value: string) {
  const element = root.querySelector<HTMLElement>(`#${id}`)
  if (element) element.textContent = value
}

export function fillAttendanceRoster(root: HTMLElement, roster: AttendancePrintRoster, session: string) {
  const startDate = roster.schedule.trim().split(/\s+/)[1] ?? ''
  setText(root, 'instructor', roster.instructor)
  setText(root, 'start_time', [startDate, roster.time].filter(Boolean).join(' ').trim())
  setText(root, 'session', session)
  setText(root, 'location', roster.location)
  setText(root, 'barcode', roster.code)

  const body = root.querySelector<HTMLTableSectionElement>('#attendance-rows')
  const header = root.querySelector<HTMLTableRowElement>('#student-rows')
  if (!body || !header) return
  Array.from(body.querySelectorAll(':scope > tr')).forEach(row => {
    if (row !== header) row.remove()
  })
  const blankCells = Math.max(header.children.length - 1, 0)

  roster.students.forEach((student, index) => {
    const row = root.ownerDocument.createElement('tr')
    row.dataset.generatedAttendanceRow = 'true'
    const nameCell = root.ownerDocument.createElement('td')
    const strong = root.ownerDocument.createElement('strong')
    strong.style.fontFamily = 'Arial, sans-serif'
    strong.textContent = `${index + 1}. ${student.name}`
    nameCell.append(strong, root.ownerDocument.createElement('br'))

    const absent = root.ownerDocument.createElement('span')
    absent.style.textDecoration = 'underline'
    absent.textContent = 'A'
    nameCell.append(absent, 'bsent/')
    const present = root.ownerDocument.createElement('span')
    present.style.textDecoration = 'underline'
    present.textContent = 'P'
    nameCell.append(present, 'resent', root.ownerDocument.createElement('br'))
    const days = root.ownerDocument.createElement('span')
    days.style.color = 'rgb(98, 98, 98)'
    days.style.fontSize = '11px'
    days.textContent = Array.from({ length: 14 }, (_, day) => `[Day ${day + 1}]`).join(' ')
    nameCell.append(days)
    row.append(nameCell)
    for (let cellIndex = 0; cellIndex < blankCells; cellIndex += 1) {
      const cell = root.ownerDocument.createElement('td')
      cell.append('\u00a0')
      row.append(cell)
    }
    body.append(row)
  })
}
