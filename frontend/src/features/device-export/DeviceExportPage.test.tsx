import { installLocalStorage } from './testStorage'
import { beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DeviceExportPage from './DeviceExportPage'
import { buildCourses } from './exportPackage'
import { loadRegistry } from './exportStorage'
import { loadExportCourses } from './loadExportCourses'
import { setCurrentSessionId } from '../../lib/sessionStorage'
import { setStorageScope } from '../../lib/storageScope'
import { session, classes, students } from './fixtures'
import type { ExportCourse } from './exportPackage'
const mocks = vi.hoisted(() => ({ current: vi.fn(), download: vi.fn() }))
vi.mock('../../app/useCurrentSession', () => ({ useCurrentSession: mocks.current }))
vi.mock('../../app/AuthContext', () => ({ useAuth: () => ({ isGuest: true }) }))
vi.mock('./loadExportCourses', () => ({ loadExportCourses: vi.fn() }))
vi.mock('./exportStorage', async original => ({ ...await original<typeof import('./exportStorage')>(), downloadJSON: mocks.download }))
const show = () => render(<MemoryRouter><DeviceExportPage /></MemoryRouter>)
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto); installLocalStorage()
  window.localStorage.clear(); window.sessionStorage.clear()
  setStorageScope('export-test'); setCurrentSessionId(session.id)
  mocks.current.mockReturnValue({ session, sessionId: session.id, loading: false })
  mocks.download.mockReset()
  vi.mocked(loadExportCourses).mockReset().mockResolvedValue(buildCourses(session, classes, students))
})
it('requires review and downloads only the chosen instructor with edited dates', async () => {
  const user = userEvent.setup(); show()
  await user.selectOptions(await screen.findByRole('combobox'), 'Alex')
  const download = screen.getByRole('button', { name: 'Download instructor classes' })
  expect(download).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Lesson dates for 004201'), { target: { value: '2026-09-04\n2026-09-18' } })
  await user.click(screen.getByRole('checkbox'))
  await user.click(download)
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
  expect(mocks.download.mock.calls[0][0].courses[0].lessonDates).toEqual(['2026-09-04', '2026-09-18'])
  expect(mocks.download.mock.calls[0][0].courses).toHaveLength(2)
  expect(loadRegistry(session.id)?.dates?.['004201']).toEqual(['2026-09-04', '2026-09-18'])
  await user.click(screen.getByRole('button', { name: 'Download ID backup' }))
  expect(mocks.download.mock.calls[1][0].kind).toBe('rec-tablet-export-ids')
  await user.selectOptions(screen.getByRole('combobox'), 'Sam')
  expect(download).toBeDisabled()
})
it('clears old instructor choices and suppresses old async results when session changes', async () => {
  let finish!: (value: ExportCourse[]) => void
  vi.mocked(loadExportCourses).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = show()
  const next = { ...session, id: 'other-session', session_day: 'Mo' }
  mocks.current.mockReturnValue({ session: next, sessionId: next.id, loading: false })
  setCurrentSessionId(next.id)
  vi.mocked(loadExportCourses).mockResolvedValue([])
  view.rerender(<MemoryRouter><DeviceExportPage /></MemoryRouter>)
  finish(buildCourses(session, classes, students))
  await screen.findByText(/No classes are available/)
  expect(screen.queryByRole('option', { name: 'Alex' })).not.toBeInTheDocument()
  expect(mocks.download).not.toHaveBeenCalled()
})
it('does not download if browser persistence fails', async () => {
  const user = userEvent.setup(); show()
  await user.selectOptions(await screen.findByRole('combobox'), 'Alex')
  await user.click(screen.getByRole('checkbox'))
  const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage is full') })
  await user.click(screen.getByRole('button', { name: 'Download instructor classes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
  expect(mocks.download).not.toHaveBeenCalled()
  spy.mockRestore()
})
it('shows a retryable error instead of enabling exports with a failed load', async () => {
  vi.mocked(loadExportCourses).mockRejectedValue(new Error('Unable to load saved assignments'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load saved assignments')
  expect(screen.getByRole('button', { name: 'Download instructor classes' })).toBeDisabled()
  vi.mocked(loadExportCourses).mockResolvedValue(buildCourses(session, classes, students))
  await userEvent.click(screen.getByRole('button', { name: 'Refresh loaded data' }))
  await screen.findByRole('option', { name: 'Alex' })
})
it('requires a selected session and never uses a stale session record', () => {
  mocks.current.mockReturnValue({ session: null, sessionId: '', loading: false }); const view = show()
  expect(screen.getByText(/Select a session and load/)).toBeInTheDocument()
  expect(loadExportCourses).not.toHaveBeenCalled()
  mocks.current.mockReturnValue({ session, sessionId: 'new-session', loading: false })
  view.rerender(<MemoryRouter><DeviceExportPage /></MemoryRouter>)
  expect(screen.getByRole('status')).toHaveTextContent('Loading selected session')
  expect(loadExportCourses).not.toHaveBeenCalled()
})
