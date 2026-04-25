import React from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, customRender, screen, waitFor } from '../../test/render'
import RostersPage from './RostersPage'

const mocks = vi.hoisted(() => ({
  useCsvImportFlow: vi.fn(),
  useDay: vi.fn(),
  useAuth: vi.fn(),
  useCurrentSession: vi.fn(),
  useCurrentTeam: vi.fn(),
  useCurrentTerm: vi.fn(),
  useRosterData: vi.fn(),
  useCustomRosters: vi.fn(),
  useRosterEdits: vi.fn(),
  useRosterFilters: vi.fn(),
  useRosterPrint: vi.fn(),
  useSchematicBoard: vi.fn(),
}))

vi.mock('../../app/CsvImportFlowContext', () => ({
  useCsvImportFlow: mocks.useCsvImportFlow,
}))

vi.mock('../../app/DayContext', () => ({
  useDay: mocks.useDay,
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../app/useCurrentSession', () => ({
  useCurrentSession: mocks.useCurrentSession,
}))

vi.mock('../../app/useCurrentTeam', () => ({
  useCurrentTeam: mocks.useCurrentTeam,
}))

vi.mock('../../app/useCurrentTerm', () => ({
  useCurrentTerm: mocks.useCurrentTerm,
}))

vi.mock('./hooks/useRosterData', () => ({
  useRosterData: mocks.useRosterData,
}))

vi.mock('./hooks/useCustomRosters', () => ({
  useCustomRosters: mocks.useCustomRosters,
}))

vi.mock('./hooks/useRosterEdits', () => ({
  useRosterEdits: mocks.useRosterEdits,
}))

vi.mock('./hooks/useRosterFilters', () => ({
  useRosterFilters: mocks.useRosterFilters,
}))

vi.mock('./hooks/useRosterPrint', () => ({
  useRosterPrint: mocks.useRosterPrint,
}))

vi.mock('../schematic/hooks/useSchematicBoard', () => ({
  useSchematicBoard: mocks.useSchematicBoard,
}))

vi.mock('../schematic/components/FullTimeRostersPanel', () => ({
  default: () => <div>Full-Time Rosters Panel</div>,
}))

vi.mock('./components/FullTimeInstructorAssignmentsPanel', () => ({
  default: () => <div>Full-Time Instructors Panel</div>,
}))

vi.mock('./components/FullTimeRequestListPanel', () => ({
  default: () => <div>Full-Time Request List Panel</div>,
}))

vi.mock('../schematic/components/SchematicBoard', () => ({
  default: () => <div>Full-Time Schematic Panel</div>,
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function setupMocks() {
  mocks.useCsvImportFlow.mockReturnValue({ requestCsvFile: vi.fn() })
  mocks.useDay.mockReturnValue({ selectedDay: 'Mo' })
  mocks.useAuth.mockReturnValue({
    accountType: 'full_time',
    isGuest: false,
    user: { id: 'user-1' },
  })
  mocks.useCurrentSession.mockReturnValue({
    access: { mode: 'owner' },
    sessionId: null,
  })
  mocks.useCurrentTeam.mockReturnValue({
    currentTeam: { id: 'team-1', name: 'Aquatics Team' },
    currentTeamId: 'team-1',
  })
  mocks.useCurrentTerm.mockReturnValue({
    currentTerm: {
      key: 'spring-2026',
      label: 'Spring 2026',
      season: 'Spring',
      year: 2026,
    },
  })
  mocks.useRosterData.mockReturnValue({
    students: [],
    setStudents: vi.fn(),
    rosters: [],
    instructorOptions: [],
    persistedStudentLevelEditMap: {},
  })
  mocks.useCustomRosters.mockReturnValue({
    customRosters: [],
    saveCustomRosters: vi.fn(),
    updateCustomRosterLevel: vi.fn(),
  })
  mocks.useRosterEdits.mockReturnValue({
    handleRosterLevelChange: vi.fn(),
    handleStudentLevelChange: vi.fn(),
  })
  mocks.useRosterFilters.mockReturnValue({
    instructorFilter: '',
    setInstructorFilter: vi.fn(),
    levelFilter: '',
    setLevelFilter: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filteredRosters: [],
  })
  mocks.useRosterPrint.mockReturnValue({
    blockedPrintJob: null,
    clearBlockedPrintJob: vi.fn(),
    handlePrintRoster: vi.fn(),
    retryBlockedPrint: vi.fn(),
  })
  mocks.useSchematicBoard.mockReturnValue({
    columns: [],
    instructors: [],
    lockedInstructors: [],
    selectedCourseCodes: [],
    toggleCourseSelection: vi.fn(),
    handleDragStart: vi.fn(),
    handleDrop: vi.fn(),
    handleDropOnCourse: vi.fn(),
    addTemporaryColumn: vi.fn(),
    removeEmptyColumns: vi.fn(),
    setInstructorAt: vi.fn(),
  })
}

function renderPage(initialPath: string) {
  setupMocks()
  return customRender(
    <MemoryRouter initialEntries={[initialPath]}>
      <RostersPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('RostersPage full-time view query', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens the request list view from the view query parameter', () => {
    renderPage('/rosters?view=requests')

    expect(screen.getByText('Full-Time Request List Panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Requests' })).toHaveClass('bg-secondary')
  })

  it('falls back to roster view for invalid view query values', () => {
    renderPage('/rosters?view=unknown')

    expect(screen.getByText('Full-Time Rosters Panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Roster View' })).toHaveClass('bg-secondary')
  })

  it('updates the view query when switching full-time roster tabs', async () => {
    const user = userEvent.setup()
    renderPage('/rosters')

    await user.click(screen.getByRole('button', { name: 'Requests' }))

    expect(screen.getByText('Full-Time Request List Panel')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/rosters?view=requests')
    })
  })
})
