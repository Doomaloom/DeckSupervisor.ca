#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '../tmp/pdf-parity/current')
const filters = process.argv.slice(2)
const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'].filter(Boolean)
let executablePath = ''
for (const candidate of candidates) { try { await access(candidate); executablePath = candidate; break } catch {} }
if (!executablePath) throw new Error('Set CHROME_PATH to an installed Chrome, Chromium, or Edge executable.')

await mkdir(output, { recursive: true })
if (!filters.length) await rm(output, { recursive: true, force: true }).then(() => mkdir(output, { recursive: true }))
const server = spawn(resolve(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', '4175'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { const response = await fetch('http://127.0.0.1:4175/pdf-parity.html'); if (response.ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const externalRequests = new Set()
    page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'data:' && url.protocol !== 'blob:') externalRequests.add(url.href) })
    await page.goto('http://127.0.0.1:4175/pdf-parity.html')
    await page.waitForFunction(() => Boolean(window.pdfParity))
    const names = await page.evaluate(() => window.pdfParity.names)
    const selected = filters.length ? names.filter(name => filters.some(filter => name.includes(filter))) : names
    if (!selected.length) throw new Error(`No PDF fixtures matched: ${filters.join(', ')}`)
    for (const name of selected) {
      const result = await page.evaluate(fixture => window.pdfParity.render(fixture), name)
      await writeFile(resolve(output, `${name}.pdf`), Buffer.from(result.base64, 'base64'))
      process.stdout.write(`${name}: ${result.durationMs} ms\n`)
    }
    if (externalRequests.size) throw new Error(`PDF generation made external requests:\n${[...externalRequests].join('\n')}`)
  } finally { await browser.close() }
} finally { server.kill('SIGTERM') }
