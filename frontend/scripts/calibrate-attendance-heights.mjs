#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDirectory, '..')
const historicalDirectory = resolve(frontendRoot, 'test-fixtures/pdf-parity/historical')
const catalogFile = resolve(frontendRoot, 'src/features/pdf/attendance/attendanceTemplateData.generated.json')
const calibrationFile = resolve(frontendRoot, 'src/features/pdf/attendance/attendanceHeightCalibration.json')
const write = process.argv.includes('--write')
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
const calibration = {}

for (const template of catalog) {
  const fixture = resolve(historicalDirectory, `attendance-${template.key}.pdf`)
  if (!existsSync(fixture)) throw new Error(`Missing historical fixture: ${basename(fixture)}`)
  const xml = execFileSync('pdftotext', ['-f', '2', '-l', '2', '-bbox-layout', fixture, '-'], { encoding: 'utf8' })
  const yMaxValues = [...xml.matchAll(/yMax="([\d.]+)"/g)].map(match => Number(match[1]))
  if (!yMaxValues.length) throw new Error(`No second-page text bounds found in ${basename(fixture)}`)
  calibration[template.key] = Number((Math.max(...yMaxValues) - 19.2).toFixed(2))
}

const serialized = `${JSON.stringify(calibration, null, 2)}\n`
if (write) {
  writeFileSync(calibrationFile, serialized)
  console.log(`Updated ${calibrationFile}`)
} else {
  process.stdout.write(serialized)
}
