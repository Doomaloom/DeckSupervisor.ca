import { describe, expect, it, vi } from 'vitest'
import { customRender, screen } from '../../../test/render'
import type { FormatOptions } from '../../../types/app'
import Day1OptionsModal from './Day1OptionsModal'

const alphabeticalOptions: FormatOptions = {
  layout: 'alphabetical',
  alphabetical_name_basis: 'first-name',
  time_headers: true,
  instructor_headers: true,
  course_headers: true,
  borders: false,
  center_time: false,
  bold_time: false,
  center_course: false,
  bold_course: false,
  font_size: 11,
}

describe('Day1OptionsModal', () => {
  it('forwards alphabetical layout settings to custom masterlist controls', () => {
    customRender(
      <Day1OptionsModal
        open
        options={{
          schematicCoverPage: false,
          highlightInstructorName: false,
          customMasterlistFormat: true,
        }}
        formatOptions={alphabeticalOptions}
        schematicScalePercent={100}
        scaleMin={60}
        scaleMax={120}
        scaleStep={5}
        onClose={vi.fn()}
        onToggle={vi.fn()}
        onToggleFormat={vi.fn()}
        onChangeLayout={vi.fn()}
        onChangeAlphabeticalNameBasis={vi.fn()}
        onChangeFontSize={vi.fn()}
        onChangeSchematicScale={vi.fn()}
        onResetSchematicScale={vi.fn()}
        onPrint={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Masterlist layout')).toHaveValue('alphabetical')
    expect(screen.getByLabelText('Alphabetize by')).toHaveValue('first-name')
    expect(screen.queryByText('Time Headers')).not.toBeInTheDocument()
    expect(screen.getByText('Borders')).toBeInTheDocument()
  })
})
