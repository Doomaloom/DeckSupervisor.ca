import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen } from '../../test/render'
import AttendanceSheetMakerPage from './AttendanceSheetMakerPage'

const mocks = vi.hoisted(() => ({
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
}))

vi.mock('../../app/useCurrentTeam', () => ({
  useCurrentTeam: mocks.useCurrentTeam,
}))

vi.mock('../../app/useCurrentTerm', () => ({
  useCurrentTerm: mocks.useCurrentTerm,
}))

vi.mock('./components/AttendanceSheetMaker', () => ({
  default: ({ teamId, teamName, selectedTermLabel }: { teamId: string; teamName: string; selectedTermLabel?: string }) => (
    <div data-testid="attendance-maker">
      {teamId} {teamName} {selectedTermLabel}
    </div>
  ),
}))

describe('AttendanceSheetMakerPage', () => {
  beforeEach(() => {
    cleanup()
    mocks.useCurrentTeam.mockReset()
    mocks.useCurrentTerm.mockReset()
    mocks.useCurrentTerm.mockReturnValue({ currentTerm: { label: 'Winter 2026' } })
  })

  it('renders the maker with current team and term context', () => {
    mocks.useCurrentTeam.mockReturnValue({
      currentTeamId: 'team-1',
      currentTeam: { id: 'team-1', name: 'Sharks' },
    })

    customRender(
      <MemoryRouter>
        <AttendanceSheetMakerPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Attendance Sheet Maker')).toBeInTheDocument()
    expect(screen.getByTestId('attendance-maker')).toHaveTextContent('team-1 Sharks Winter 2026')
  })

  it('prompts for a team when no current team is selected', () => {
    mocks.useCurrentTeam.mockReturnValue({
      currentTeamId: '',
      currentTeam: null,
    })

    customRender(
      <MemoryRouter>
        <AttendanceSheetMakerPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Select a team first')).toBeInTheDocument()
    expect(screen.queryByTestId('attendance-maker')).not.toBeInTheDocument()
  })
})
