#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'backend', 'swimming attendance')
const outputPath = path.join(
  root,
  'frontend',
  'src',
  'features',
  'pdf',
  'attendance',
  'attendanceTemplateData.generated.json',
)

const decodeEntities = value =>
  value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))

const htmlToText = value =>
  decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<\/li\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const files = fs
  .readdirSync(sourceDir)
  .filter(name => name.endsWith('.html'))
  .sort((left, right) => left.localeCompare(right))

const templates = files.map(fileName => {
  const key = path.basename(fileName, '.html')
  const html = fs.readFileSync(path.join(sourceDir, fileName), 'utf8')
  const titleMatch = html.match(/<font\s+size=["']?5["']?[^>]*>([\s\S]*?)<\/font>/i)
  const title = titleMatch ? htmlToText(titleMatch[1]) : key.replace(/([a-z])([A-Z0-9])/g, '$1 $2')

  const rotatedCells = Array.from(
    html.matchAll(/<td\b[^>]*class=["'][^"']*\brotate(?:\s|["'])[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi),
  ).map(match => htmlToText(match[1]))

  const special = text => rotatedCells.some(label => label.toLowerCase().includes(text))
  const skills = rotatedCells.filter(label => {
    const normalized = label.toLowerCase()
    return (
      label &&
      !normalized.includes('previous level') &&
      normalized !== 'result' &&
      !normalized.includes('register in')
    )
  })

  const breakMatch = html.match(/<p\b[^>]*class=["'][^"']*break-before-page[^"']*["'][^>]*>[\s\S]*?<\/p>/i)
  const backHtml = breakMatch ? html.slice((breakMatch.index ?? 0) + breakMatch[0].length) : ''
  const backText = htmlToText(backHtml)
    .replace(/document\.onreadystatechange[\s\S]*$/i, '')
    .trim()
  const backSections = backText
    .split(/\n{2,}/)
    .map(section => section.trim())
    .filter(Boolean)

  return {
    key,
    title,
    skills,
    backSections,
    showPreviousLevel: special('previous level'),
    showResult: special('result'),
    showRegisterIn: special('register in'),
    compactBackPage: key === 'SplashPrivate',
  }
})

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(templates, null, 2)}\n`)
console.log(`Wrote ${templates.length} attendance templates to ${path.relative(root, outputPath)}`)
