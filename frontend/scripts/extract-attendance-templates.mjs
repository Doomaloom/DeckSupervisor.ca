#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const revision = process.argv[2] || 'c315c452d8c0b3aabfff324f702f89aee3ce8a2e'
const output = fileURLToPath(new URL('../src/features/pdf/attendance/attendanceTemplateData.generated.json', import.meta.url))
const prefix = 'backend/swimming attendance/'
const files = execFileSync('git', ['ls-tree', '--full-tree', '-r', '--name-only', revision], { encoding: 'utf8' })
  .split('\n').filter(path => path.startsWith(prefix) && path.endsWith('.html')).sort()

const number = (text, name, fallback = 0) => Number(text.match(new RegExp(`${name}\\s*:\\s*([\\d.]+)px`))?.[1] ?? fallback)
const width = element => Number(element.getAttribute('style')?.match(/width:\s*([\d.]+)pt/i)?.[1] ?? element.getAttribute('width') ?? 0)
const text = element => element.textContent.replaceAll('\u00a0', ' ').replace(/\s+/g, ' ').trim()

const catalog = files.map(path => {
  const html = execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  const document = new JSDOM(html).window.document
  const page = document.querySelector('.templatePage')
  const pageStyle = page?.getAttribute('style') ?? ''
  const tables = [...(page?.querySelectorAll('table') ?? [])]
  const frontCells = [...(tables[0]?.querySelector('tr')?.children ?? [])]
  const backCells = [...(tables[1]?.querySelector('tr')?.children ?? [])]
  const key = path.slice(prefix.length, -5).replaceAll(' ', '')
  const title = text(frontCells[0]?.querySelector('font[size="5"]') ?? frontCells[0] ?? document.body)
  return {
    key,
    title,
    sheetWidthPx: number(pageStyle, '--sheet-width', 1300),
    rotateHeightPx: number(pageStyle, '--rotate-height', 300),
    rotateTranslatePx: number(pageStyle, '--rotate-translate', 190),
    rotateTopPx: number(pageStyle, '--rotate-top', 100),
    headerWidthPt: width(frontCells[0]),
    headerHeightPt: Number(frontCells[0]?.getAttribute('style')?.match(/height:\s*([\d.]+)pt/i)?.[1] ?? 50),
    columns: frontCells.slice(1).map(cell => ({ text: text(cell), widthPt: width(cell) || 50 })),
    backTableWidthPt: Number(tables[1]?.className.match(/w-\[([\d.]+)pt\]/)?.[1] ?? 1200),
    backColumns: backCells.map(cell => {
      const blocks = [...cell.querySelectorAll(':scope > p')].map(block => text(block)).filter(Boolean)
      return { widthPt: width(cell), blocks: blocks.length ? blocks : [text(cell)].filter(Boolean) }
    }),
    compactBackPage: key === 'SplashPrivate',
  }
})

writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Extracted ${catalog.length} attendance templates from ${revision}`)
