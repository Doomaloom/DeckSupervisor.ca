import { describe, expect, it } from 'vitest'
import {
  buildCsvHeaderIndex,
  getCsvHeaderValue,
  hasAnyCsvHeader,
  normalizeCsvHeader,
  parseCsvText,
} from './csvUtils'

describe('csvUtils', () => {
  it('parses CSV rows including quoted commas and escaped quotes', () => {
    const rows = parseCsvText('Name,Note\n"Alice, A.","He said ""Hi"""')

    expect(rows).toEqual([
      ['Name', 'Note'],
      ['Alice, A.', 'He said "Hi"'],
    ])
  })

  it('skips blank rows and supports CRLF endings', () => {
    const rows = parseCsvText('Name,Phone\r\n\r\nBob,123\r\n')

    expect(rows).toEqual([
      ['Name', 'Phone'],
      ['Bob', '123'],
    ])
  })

  it('normalizes headers with BOMs and optional stripping', () => {
    expect(normalizeCsvHeader('\uFEFF First Name ')).toBe('first name')
    expect(normalizeCsvHeader('First Name', { stripNonAlphanumeric: true })).toBe('firstname')
  })

  it('builds a header index and finds alternate header names', () => {
    const headerIndex = buildCsvHeaderIndex([' First Name ', 'Phone Number'], {
      stripNonAlphanumeric: true,
    })

    expect(hasAnyCsvHeader(headerIndex, ['FirstName'], { stripNonAlphanumeric: true })).toBe(true)
    expect(hasAnyCsvHeader(headerIndex, ['Instructor Name'], { stripNonAlphanumeric: true })).toBe(false)
  })

  it('returns trimmed values for the first matching header and handles missing headers safely', () => {
    const headerIndex = buildCsvHeaderIndex(['First Name', 'Phone Number'], {
      stripNonAlphanumeric: true,
    })
    const row = [' Alice ', ' 555-1234 ']

    expect(
      getCsvHeaderValue(row, headerIndex, ['Student First Name', 'First Name'], {
        stripNonAlphanumeric: true,
      }),
    ).toBe('Alice')
    expect(
      getCsvHeaderValue(row, headerIndex, ['Instructor Name'], {
        stripNonAlphanumeric: true,
      }),
    ).toBe('')
  })
})
