import { describe, expect, it, vi } from 'vitest'
import { screen } from '../test/render'
import { customRender } from '../test/render'
import CsvSessionImportModal from './CsvSessionImportModal'

describe('CsvSessionImportModal', () => {
  it('shows combined raw locations for grouped matches', () => {
    customRender(
      <CsvSessionImportModal
        open
        loading={false}
        processing={false}
        error=""
        fileName="roster.csv"
        candidates={[
          {
            sessionKey: 'session-1',
            sourceSessionKeys: ['raw-1', 'raw-2'],
            rawLocations: ['Big Pool', 'Small Pool'],
            dayOfWeek: 'Sa',
            sessionSeason: 'Winter',
            sessionYear: 2026,
            startDate: '2026-01-01',
            endDate: '2026-03-01',
            location: 'Main Pool',
            sessionStartTime24: '09:00',
            sessionEndTime24: '11:00',
            classCount: 2,
            studentCount: 18,
            waitlistCount: 0,
            courseCodes: ['100', '200'],
            matchedSession: null,
          },
        ]}
        onClose={vi.fn()}
        onSelectCandidate={vi.fn()}
      />,
    )

    expect(screen.getByText('Includes: Big Pool, Small Pool')).toBeInTheDocument()
  })
})
