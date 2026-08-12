import { describe, expect, it, vi } from 'vitest'
import { onAppNotice, showAppNotice } from './appNotice'

describe('app notices', () => {
  it('delivers trimmed non-blocking notices with their tone', () => {
    const listener = vi.fn()
    const unsubscribe = onAppNotice(listener)

    showAppNotice('  CSV imported successfully.  ', 'success')

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      message: 'CSV imported successfully.',
      tone: 'success',
    }))
    unsubscribe()
  })

  it('ignores empty messages and supports unsubscribing', () => {
    const listener = vi.fn()
    const unsubscribe = onAppNotice(listener)

    showAppNotice('   ')
    unsubscribe()
    showAppNotice('No longer observed')

    expect(listener).not.toHaveBeenCalled()
  })
})
