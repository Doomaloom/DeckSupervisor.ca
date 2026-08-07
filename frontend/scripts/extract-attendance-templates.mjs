#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const revision = process.argv.slice(2).find(argument => !argument.startsWith('--')) || 'c315c452d8c0b3aabfff324f702f89aee3ce8a2e'
const checkOnly = process.argv.includes('--check')
const output = fileURLToPath(new URL('../src/features/pdf/attendance/attendanceTemplateData.generated.json', import.meta.url))
const prefix = 'backend/swimming attendance/'
const files = execFileSync('git', ['ls-tree', '--full-tree', '-r', '--name-only', revision], { encoding: 'utf8' })
  .split('\n').filter(path => path.startsWith(prefix) && path.endsWith('.html')).sort()

const number = (text, name, fallback = 0) => Number(text.match(new RegExp(`${name}\\s*:\\s*([\\d.]+)px`))?.[1] ?? fallback)
const width = element => Number(element?.getAttribute('style')?.match(/width:\s*([\d.]+)pt/i)?.[1] ?? element?.getAttribute('width') ?? 0)
const normalizedText = value => value.replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim()
const elementText = element => normalizedText(element?.textContent ?? '')

function appendSpan(line, text, bold) {
  if (!text) return
  const previous = line.at(-1)
  if (previous?.bold === bold) previous.text += text
  else line.push({ text, bold })
}

function richLines(element) {
  const lines = [[]]
  const visit = (node, bold = false) => {
    if (node.nodeType === node.TEXT_NODE) {
      appendSpan(lines.at(-1), node.nodeValue ?? '', bold)
      return
    }
    if (node.nodeType !== node.ELEMENT_NODE) return
    if (node.tagName === 'BR') {
      lines.push([])
      return
    }
    const childBold = bold || node.tagName === 'B' || node.tagName === 'STRONG'
    node.childNodes.forEach(child => visit(child, childBold))
  }
  element.childNodes.forEach(node => visit(node))

  return lines.map(rawSpans => {
    const spans = rawSpans
      .map(span => ({ ...span, text: span.text.replace(/\s+/g, ' ') }))
      .filter(span => span.text.trim())
    if (!spans.length) return null
    spans[0].text = spans[0].text.trimStart()
    spans.at(-1).text = spans.at(-1).text.trimEnd()
    const fullText = spans.map(span => span.text).join('')
    const leading = fullText.match(/^([•-])\s*/)
    const marker = leading?.[1] === '•' ? 'bullet' : leading?.[1] === '-' ? 'dash' : 'none'
    if (leading) {
      let remaining = leading[0].length
      while (remaining > 0 && spans.length) {
        if (spans[0].text.length <= remaining) {
          remaining -= spans[0].text.length
          spans.shift()
        } else {
          spans[0].text = spans[0].text.slice(remaining)
          remaining = 0
        }
      }
    }
    return { spans, marker, indentLevel: marker === 'none' ? 0 : 1 }
  }).filter(Boolean)
}

function assessmentBackPage(table) {
  const cells = [...(table?.querySelector('tr')?.children ?? [])]
  const columns = cells.filter(cell => width(cell) > 20).map(cell =>
    [...cell.querySelectorAll(':scope > p')]
      .map(paragraph => ({ lines: richLines(paragraph) }))
      .filter(block => block.lines.length && block.lines.some(line => line.spans.some(span => span.text.trim()))),
  )
  if (columns.length !== 3) throw new Error(`expected three assessment columns, found ${columns.length}`)
  const naturalHeightPt = Math.max(...columns.map(column => column.reduce((height, block) => {
    const lineUnits = block.lines.reduce((sum, line) => {
      const length = line.spans.reduce((total, span) => total + span.text.length, 0)
      return sum + Math.max(1, Math.ceil(length / 78))
    }, 0)
    return height + lineUnits * 4.71 * 1.25 + 4.71
  }, 0)))
  return { kind: 'assessment', columns, naturalHeightPt: Number(naturalHeightPt.toFixed(2)) }
}

function privateBackPage(table) {
  const blocks = [...table.querySelectorAll('.private-skill-block')].map(block => {
    const title = normalizedText(block.querySelector('strong')?.textContent ?? '')
    const lines = richLines(block).map(line => normalizedText(line.spans.map(span => span.text).join(''))).filter(Boolean)
    if (lines[0] === title) lines.shift()
    return { title, entries: lines.map(line => line.replace(/^\s*-\s*/, '')).filter(Boolean) }
  }).filter(block => block.title)
  if (blocks.length !== 17) throw new Error(`expected 17 private catalog blocks, found ${blocks.length}`)
  const columns = [blocks.slice(0, 6), blocks.slice(6, 10), blocks.slice(10)]
  const naturalHeightPt = Math.max(...columns.map(column => column.reduce((height, block) =>
    height + (1 + block.entries.reduce((sum, entry) => sum + Math.max(1, Math.ceil(entry.length / 86)), 0)) * 5.42 * 1.05 + 1.88,
  0)))
  return { kind: 'private-catalog', columns, naturalHeightPt: Number(naturalHeightPt.toFixed(2)) }
}

const catalog = files.map(path => {
  const html = execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  const document = new JSDOM(html).window.document
  const page = document.querySelector('.templatePage')
  const pageStyle = page?.getAttribute('style') ?? ''
  const tables = [...(page?.querySelectorAll('table') ?? [])]
  const frontCells = [...(tables[0]?.querySelector('tr')?.children ?? [])]
  const key = path.slice(prefix.length, -5).replaceAll(' ', '')
  const title = elementText(frontCells[0]?.querySelector('font[size="5"]') ?? frontCells[0] ?? document.body)
  return {
    key,
    title,
    sheetWidthPx: number(pageStyle, '--sheet-width', 1300),
    rotateHeightPx: number(pageStyle, '--rotate-height', 300),
    rotateTranslatePx: number(pageStyle, '--rotate-translate', 190),
    rotateTopPx: number(pageStyle, '--rotate-top', 100),
    headerWidthPt: width(frontCells[0]),
    headerHeightPt: Number(frontCells[0]?.getAttribute('style')?.match(/height:\s*([\d.]+)pt/i)?.[1] ?? 50),
    columns: frontCells.slice(1).map(cell => ({ text: elementText(cell), widthPt: width(cell) || 50 })),
    backPage: key === 'SplashPrivate' ? privateBackPage(tables[1]) : assessmentBackPage(tables[1]),
  }
})

const serialized = `${JSON.stringify(catalog, null, 2)}\n`
if (checkOnly) {
  if (readFileSync(output, 'utf8') !== serialized) {
    console.error('Attendance template catalog is stale. Run npm run attendance:catalog:generate.')
    process.exit(1)
  }
  console.log(`Verified ${catalog.length} attendance templates from ${revision}`)
} else {
  writeFileSync(output, serialized)
  console.log(`Extracted ${catalog.length} attendance templates from ${revision}`)
}
