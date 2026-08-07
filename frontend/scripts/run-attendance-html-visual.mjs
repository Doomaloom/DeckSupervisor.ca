#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const root = resolve(import.meta.dirname, '../..')
const frontend = resolve(root, 'frontend')
const currentDir = resolve(root, 'tmp/pdf-parity/html-current')
const keys = ['LittleSplash1','LittleSplash2','LittleSplash3','LittleSplash4','LittleSplash5','ParentandTot1','ParentandTot2','ParentandTot3','Splash1','Splash2A','Splash2B','Splash3','Splash4','Splash5','Splash6','Splash7','Splash8','Splash9','SplashFitness','SplashPrivate','TeenAdult1','TeenAdult2','TeenAdult3']

async function executablePath() {
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'].filter(Boolean)
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate } catch { /* try the next installed browser */ }
  }
  throw new Error('No installed Chrome, Chromium, or Edge executable was found. Set CHROME_PATH to its executable.')
}

function requestedFixtures() {
  const value = process.argv.slice(2).find(argument => !argument.startsWith('-'))
  if (!value || value === 'all' || value === 'backs') return keys.map(key => `attendance-${key}`)
  if (['paired', 'odd', 'covers'].includes(value)) return [value]
  return [`attendance-${value.replace(/^attendance-/, '')}`]
}

async function waitForServer(url, processHandle) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error(`Vite exited with code ${processHandle.exitCode}.`)
    try { const response = await fetch(url); if (response.ok) return } catch { /* server is starting */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
  }
  throw new Error('Timed out waiting for the attendance visual fixture server.')
}

async function availablePort() {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate a visual-test port.'))
      probe.close(error => error ? reject(error) : resolvePort(address.port))
    })
  })
}

await mkdir(currentDir, { recursive: true })
const port = await availablePort()
const server = spawn(process.execPath, [resolve(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: frontend, stdio: ['ignore', 'pipe', 'inherit'] })
try {
  await waitForServer(`http://127.0.0.1:${port}/attendance-print-fixture.html`, server)
  const browser = await chromium.launch({ executablePath: await executablePath(), headless: true })
  try {
    for (const name of requestedFixtures()) {
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${port}/attendance-print-fixture.html?fixture=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.__ATTENDANCE_FIXTURE_READY__ || window.__ATTENDANCE_FIXTURE_ERROR__, null, { timeout: 15000 })
      const error = await page.evaluate(() => window.__ATTENDANCE_FIXTURE_ERROR__)
      if (error) throw new Error(`${name}: ${error}`)
      const pdf = await page.pdf({ landscape: true, format: 'Letter', printBackground: true, preferCSSPageSize: true })
      await writeFile(resolve(currentDir, `${name}.pdf`), pdf)
      await page.close()
      process.stdout.write(`Rendered ${name}\n`)
    }
  } finally {
    await browser.close()
  }
} finally {
  server.kill('SIGTERM')
}

const selected = requestedFixtures()
const historicalTargets = selected.filter(name => name.startsWith('attendance-'))
if (historicalTargets.length) {
  const filter = historicalTargets.length === 1 ? historicalTargets[0] : 'attendance-*'
  const result = spawnSync('bash', [resolve(root, 'scripts/pdf-parity/compare-pdfs.sh'), resolve(frontend, 'test-fixtures/pdf-parity/historical'), currentDir, resolve(root, 'tmp/pdf-parity/html-diffs'), filter], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
