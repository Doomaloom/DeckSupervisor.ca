import { beforeEach, describe, expect, it } from 'vitest'
import { getMasterlistDraftOptions, setMasterlistDraftOptions } from './storage'
import { getScopedKey, setStorageScope } from './storageScope'

describe('masterlist option storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setStorageScope('guest')
  })

  it('normalizes legacy stored options to the class and time layout', () => {
    window.sessionStorage.setItem(
      getScopedKey('masterlistDraftOptions'),
      JSON.stringify({ time_headers: true, font_size: 12 }),
    )

    expect(getMasterlistDraftOptions()).toMatchObject({
      layout: 'class-time',
      alphabetical_name_basis: 'last-name',
      time_headers: true,
      font_size: 12,
    })
  })

  it('persists alphabetical layout choices within the active scope', () => {
    const options = getMasterlistDraftOptions()
    setMasterlistDraftOptions({
      ...options,
      layout: 'alphabetical',
      alphabetical_name_basis: 'first-name',
    })

    expect(getMasterlistDraftOptions()).toMatchObject({
      layout: 'alphabetical',
      alphabetical_name_basis: 'first-name',
    })
  })
})
