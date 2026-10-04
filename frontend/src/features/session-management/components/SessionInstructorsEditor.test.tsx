import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import SessionInstructorsEditor from './SessionInstructorsEditor'
const api = vi.hoisted(() => ({ searchLinkableProfiles: vi.fn() }))
vi.mock('../../../lib/serverApi', () => api)
const account = { id: 'staff', first_name: 'Alex', last_name: 'Staff', email: 'alex@example.invalid' }
const row = { id: 'row-a', name: 'Alex', account_id: null, account: null, class_count: 0 }
const props = { sessionId: 'session-a', instructors: [row], isGuest: false, onRetry: vi.fn(), onCountChange: vi.fn(() => true), onNameChange: vi.fn(), onAccountChange: vi.fn() }
beforeEach(() => { vi.clearAllMocks(); api.searchLinkableProfiles.mockResolvedValue({ results: [account] }) })
it('edits the count only on blur or Enter and accepts zero', async () => {
  const user = userEvent.setup()
  render(<SessionInstructorsEditor {...props} />)
  const input = screen.getByLabelText('Number of instructors')
  await user.clear(input); await user.type(input, '3')
  expect(props.onCountChange).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(props.onCountChange).toHaveBeenCalledWith(3)
  await user.clear(input); await user.type(input, '0'); await user.tab()
  expect(props.onCountChange).toHaveBeenCalledWith(0)
})
it('rejects invalid counts and restores the count after a canceled reduction', async () => {
  const user = userEvent.setup()
  props.onCountChange.mockReturnValueOnce(false)
  render(<SessionInstructorsEditor {...props} />)
  const input = screen.getByLabelText('Number of instructors')
  await user.clear(input); await user.type(input, '-1'); await user.tab()
  expect(await screen.findByRole('alert')).toHaveTextContent('whole number')
  expect(props.onCountChange).not.toHaveBeenCalled()
  await user.clear(input); await user.type(input, '0'); await user.keyboard('{Enter}')
  expect(input).toHaveValue(1)
})
it('selects an optional account without replacing the name and stages unlinking', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<SessionInstructorsEditor {...props} />)
  await user.type(screen.getByLabelText('Optional account for instructor 1'), 'alex@example.invalid')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await user.click(await screen.findByRole('button', { name: 'Select account' }))
  expect(api.searchLinkableProfiles).toHaveBeenCalledWith('session-a', account.email)
  expect(props.onAccountChange).toHaveBeenCalledWith('row-a', account)
  expect(props.onNameChange).not.toHaveBeenCalled()
  rerender(<SessionInstructorsEditor {...props} instructors={[{ ...row, account_id: account.id, account }]} />)
  await user.click(screen.getByRole('button', { name: 'Unlink' }))
  expect(props.onAccountChange).toHaveBeenLastCalledWith('row-a', null)
  expect(screen.queryByRole('button', { name: 'Save link' })).not.toBeInTheDocument()
})
it('keeps duplicate names distinct and hides account search for guests and shared viewers', () => {
  const { rerender } = render(<SessionInstructorsEditor {...props} instructors={[row, { ...row, id: 'row-b' }]} />)
  expect(within(screen.getByRole('group', { name: 'Instructor 1' })).getByLabelText('Instructor 1 name')).toHaveValue('Alex')
  expect(within(screen.getByRole('group', { name: 'Instructor 2' })).getByLabelText('Instructor 2 name')).toHaveValue('Alex')
  rerender(<SessionInstructorsEditor {...props} isGuest />)
  expect(screen.queryByPlaceholderText('Search first name, last name or email')).not.toBeInTheDocument()
  rerender(<SessionInstructorsEditor {...props} readOnly />)
  expect(screen.getByLabelText('Instructor 1 name')).toBeDisabled()
  expect(screen.getByLabelText('Number of instructors')).toBeDisabled()
})
