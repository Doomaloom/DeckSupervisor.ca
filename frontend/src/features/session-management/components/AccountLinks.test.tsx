import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import AccountLinks from './AccountLinks'

const api = vi.hoisted(() => ({ fetchInstructorAssignments: vi.fn(), linkInstructorAssignment: vi.fn(), searchLinkableProfiles: vi.fn() }))
vi.mock('../../../lib/serverApi', () => api)
const alex = { id: 'account-a', first_name: 'Alex', last_name: 'Staff', email: 'alex@example.invalid' }
const blair = { id: 'account-b', first_name: 'Blair', last_name: 'Staff', email: 'blair@example.invalid' }
const assignment = { id: 'column-a', name: 'Alex column', account_id: alex.id, account: alex }
beforeEach(() => {
  vi.resetAllMocks()
  api.fetchInstructorAssignments.mockResolvedValue({ assignments: [assignment] })
  api.linkInstructorAssignment.mockResolvedValue({ assignments: [] })
  api.searchLinkableProfiles.mockResolvedValue({ results: [blair] })
})

it('searches by email, explicitly selects and saves a replacement, then unlinks', async () => {
  const user = userEvent.setup()
  render(<AccountLinks sessionId="session-a" />)
  expect(await screen.findByText(/Linked account: Alex Staff/)).toBeVisible()
  await user.type(screen.getByLabelText('Search account for Alex column'), blair.email)
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await user.click(await screen.findByRole('button', { name: 'Select account' }))
  expect(api.searchLinkableProfiles).toHaveBeenCalledWith('session-a', blair.email)
  expect(api.linkInstructorAssignment).not.toHaveBeenCalled()
  api.fetchInstructorAssignments.mockResolvedValue({ assignments: [{ ...assignment, account_id: blair.id, account: blair }] })
  await user.click(screen.getByRole('button', { name: 'Save link' }))
  expect(await screen.findByText(/Linked account: Blair Staff/)).toBeVisible()
  expect(api.linkInstructorAssignment).toHaveBeenCalledWith('session-a', 'column-a', blair.id)
  api.fetchInstructorAssignments.mockResolvedValue({ assignments: [{ ...assignment, account_id: null, account: null }] })
  await user.click(screen.getByRole('button', { name: 'Unlink' }))
  expect(await screen.findByText('Linked account: Unlinked')).toBeVisible()
  expect(api.linkInstructorAssignment).toHaveBeenCalledWith('session-a', 'column-a', null)
})

it('reports empty searches and search failures', async () => {
  const user = userEvent.setup()
  api.searchLinkableProfiles.mockResolvedValueOnce({ results: [] }).mockRejectedValueOnce(new Error('Search unavailable'))
  render(<AccountLinks sessionId="session-a" />)
  await user.type(await screen.findByLabelText('Search account for Alex column'), 'Missing')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText('No accounts found.')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable')
})

it('blocks duplicate saves and allows retry after a failed save', async () => {
  const user = userEvent.setup()
  let rejectSave!: (error: Error) => void
  api.linkInstructorAssignment.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject }))
  render(<AccountLinks sessionId="session-a" />)
  await user.type(await screen.findByLabelText('Search account for Alex column'), 'Blair')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await user.click(await screen.findByRole('button', { name: 'Select account' }))
  await user.dblClick(screen.getByRole('button', { name: 'Save link' }))
  expect(api.linkInstructorAssignment).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  rejectSave(new Error('Save unavailable'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable')
  expect(screen.getByRole('button', { name: 'Save link' })).toBeEnabled()
})

it('clears selection and ignores pending searches when switching sessions', async () => {
  const user = userEvent.setup()
  let resolveSearch!: (response: { results: typeof blair[] }) => void
  api.searchLinkableProfiles.mockImplementation(() => new Promise(resolve => { resolveSearch = resolve }))
  const { rerender } = render(<AccountLinks sessionId="session-a" />)
  await user.type(await screen.findByLabelText('Search account for Alex column'), 'Blair')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  api.fetchInstructorAssignments.mockResolvedValue({ assignments: [{ ...assignment, name: 'New column', account_id: null, account: null }] })
  rerender(<AccountLinks sessionId="session-b" />)
  await screen.findByLabelText('Search account for New column')
  resolveSearch({ results: [blair] })
  await waitFor(() => expect(screen.queryByText(blair.email)).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Save link' })).toBeDisabled()
})

it('refreshes saved columns and keeps identical names as separate assignments', async () => {
  const user = userEvent.setup()
  api.fetchInstructorAssignments.mockResolvedValueOnce({ assignments: [] }).mockResolvedValue({ assignments: [assignment, { ...assignment, id: 'column-b' }] })
  render(<AccountLinks sessionId="session-a" />)
  expect(await screen.findByText(/No saved columns/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Refresh saved columns' }))
  const rows = await screen.findAllByRole('group', { name: 'Account link for Alex column' })
  expect(rows).toHaveLength(2)
  await user.click(within(rows[1]).getByRole('button', { name: 'Unlink' }))
  expect(api.linkInstructorAssignment).toHaveBeenCalledWith('session-a', 'column-b', null)
})
