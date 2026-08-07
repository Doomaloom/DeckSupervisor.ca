import type { SchematicPdfRequest } from '../pdf/types'
import {
  buildSchematicMatrix,
  effectiveSchematicScale,
  formatSchematicTime,
} from '../pdf/schematic/schematicModel'

function element(document: Document, tag: string, styles: Partial<CSSStyleDeclaration> = {}) {
  const node = document.createElement(tag)
  Object.assign(node.style, styles)
  return node
}

function textCell(document: Document, text: string, width: number, height: number, styles: Partial<CSSStyleDeclaration> = {}) {
  const cell = element(document, 'div', {
    width: `${width}pt`, height: `${height}pt`, border: '1pt solid #000', display: 'flex',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden',
    fontSize: '11pt', lineHeight: '1.1', ...styles,
  })
  cell.textContent = text
  return cell
}

export function buildSchematicCoverElement(document: Document, request: SchematicPdfRequest) {
  const orientation = request.orientation === 'landscape' ? 'landscape' : 'portrait'
  const model = buildSchematicMatrix(request)
  if (!model) throw new Error('No schematic data found for the attendance cover.')
  const scale = effectiveSchematicScale(orientation, model.totalRows, request.scalePercent)
  const printableWidth = orientation === 'landscape' ? 756 : 576
  const timeWeight = 16.5
  const classWeight = 26
  const totalWeight = timeWeight * 2 + classWeight * model.columnCount
  const timeWidth = printableWidth * scale * timeWeight / totalWeight
  const classWidth = printableWidth * scale * classWeight / totalWeight
  const tableWidth = printableWidth * scale
  const highlighted = (index: number) => Boolean(
    request.highlightInstructor && request.selectedInstructor
      && !['none', 'one-each'].includes(request.selectedInstructor)
      && request.instructors?.[index]?.trim().toLowerCase() === request.selectedInstructor.trim().toLowerCase(),
  )

  const table = element(document, 'div', { width: `${tableWidth}pt`, fontFamily: 'Arial, sans-serif', color: '#111' })
  const band = (value: string, height: number, fontSize: number) => {
    const node = textCell(document, value, tableWidth, height * scale, {
      backgroundColor: '#000', color: '#fff', fontSize: `${fontSize * scale}pt`, fontWeight: '700',
    })
    table.append(node)
  }
  band(request.title?.trim() || 'Schematic', 30, 20)
  table.append(element(document, 'div', { height: `${3.75 * scale}pt` }))
  band(request.dateRange ?? '', 30, 16)

  const metadata = element(document, 'div', { display: 'flex', height: `${30 * scale}pt` })
  metadata.append(
    textCell(document, `Deck Supervisor:${request.deckSupervisorName?.trim() ? ` ${request.deckSupervisorName.trim()}` : ''}`, tableWidth / 2, 30 * scale, { fontWeight: '600' }),
    textCell(document, `Cancelled Dates:${request.weeksLabel ? `\n${request.weeksLabel}` : ''}`, tableWidth / 2, 30 * scale, { fontWeight: '600', whiteSpace: 'pre-line' }),
  )
  table.append(metadata)

  const header = element(document, 'div', { display: 'flex', height: `${36 * scale}pt` })
  header.append(textCell(document, 'TIME', timeWidth, 36 * scale, { fontWeight: '700' }))
  const instructorHeader = element(document, 'div', { width: `${classWidth * model.columnCount}pt` })
  instructorHeader.append(textCell(document, 'Instructors / Level', classWidth * model.columnCount, 18 * scale, { fontWeight: '700' }))
  const instructorRow = element(document, 'div', { display: 'flex' })
  Array.from({ length: model.columnCount }, (_, index) => {
    instructorRow.append(textCell(document, request.instructors?.[index]?.trim() || `Instructor ${index + 1}`, classWidth, 18 * scale, {
      backgroundColor: highlighted(index) ? '#FFEB3B' : '#fff', fontWeight: '600',
    }))
  })
  instructorHeader.append(instructorRow)
  header.append(instructorHeader, textCell(document, 'TIME', timeWidth, 36 * scale, { fontWeight: '700' }))
  table.append(header)

  model.matrix.forEach((row, rowIndex) => {
    const rowNode = element(document, 'div', { display: 'flex', height: `${15 * scale}pt` })
    const time = rowIndex % 4 === 0 ? formatSchematicTime(model.baseMinutes + Math.floor(rowIndex / 4) * 30) : ''
    rowNode.append(textCell(document, time, timeWidth, 15 * scale))
    row.forEach((cell, columnIndex) => {
      const cellNode = textCell(document, cell.text ?? '', classWidth, 15 * scale, {
        backgroundColor: highlighted(columnIndex) ? '#FFEB3B' : cell.kind === 'empty' ? '#D9D9D9' : cell.color ?? '#fff',
        borderTopWidth: cell.border === 'middle' || cell.border === 'bottom' ? '0' : '1pt',
        borderBottomWidth: cell.border === 'middle' || cell.border === 'top' ? '0' : '1pt',
        borderLeftWidth: cell.kind === 'empty' ? '0' : '1pt',
        borderRightWidth: cell.kind === 'empty' ? '0' : '1pt',
      })
      rowNode.append(cellNode)
    })
    rowNode.append(textCell(document, time, timeWidth, 15 * scale))
    table.append(rowNode)
  })

  const viewport = element(document, 'div', {
    width: '10.6in', height: '8.1in', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden',
  })
  if (orientation === 'portrait') {
    const rotated = element(document, 'div', {
      position: 'relative', width: '8.1in', height: '10.6in',
      transform: 'translateY(8.1in) rotate(-90deg)', transformOrigin: 'top left',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    })
    rotated.append(table)
    viewport.append(rotated)
  } else {
    viewport.append(table)
  }
  return viewport
}
