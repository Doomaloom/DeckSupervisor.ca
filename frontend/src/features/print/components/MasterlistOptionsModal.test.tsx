import { describe, expect, it, vi } from 'vitest'
import { customRender, fireEvent, screen } from '../../../test/render'
import type { FormatOptions } from '../../../types/app'
import MasterlistOptionsModal from './MasterlistOptionsModal'

const classTimeOptions: FormatOptions = {
  layout: 'class-time',
  alphabetical_name_basis: 'last-name',
  time_headers: false,
  instructor_headers: false,
  course_headers: false,
  borders: false,
  center_time: false,
  bold_time: false,
  center_course: false,
  bold_course: false,
  font_size: 11,
}

function renderModal(formatOptions: FormatOptions, schematicCoverPage = false) {
  const onChangeLayout = vi.fn()
  const onChangeAlphabeticalNameBasis = vi.fn()
  customRender(
    <MasterlistOptionsModal
      open
      extras={{ schematicCoverPage }}
      coverOrientation="portrait"
      schematicScalePercent={100}
      scaleMin={60}
      scaleMax={120}
      scaleStep={5}
      formatOptions={formatOptions}
      previewUrl={null}
      isPreviewLoading={false}
      previewError={null}
      onToggleFormat={vi.fn()}
      onChangeLayout={onChangeLayout}
      onChangeAlphabeticalNameBasis={onChangeAlphabeticalNameBasis}
      onChangeFontSize={vi.fn()}
      onClose={vi.fn()}
      onToggle={vi.fn()}
      onSelectCoverOrientation={vi.fn()}
      onChangeSchematicScale={vi.fn()}
      onResetSchematicScale={vi.fn()}
      onPrint={vi.fn()}
    />,
  )
  return { onChangeLayout, onChangeAlphabeticalNameBasis }
}

describe('MasterlistOptionsModal', () => {
  it('shows class and time formatting only for the class and time layout', () => {
    const { onChangeLayout } = renderModal(classTimeOptions)

    expect(screen.getByText('Time Headers')).toBeInTheDocument()
    expect(screen.getByText('Course Headers')).toBeInTheDocument()
    expect(screen.queryByLabelText('Alphabetize by')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Masterlist layout'), { target: { value: 'alphabetical' } })
    expect(onChangeLayout).toHaveBeenCalledWith('alphabetical')
  })

  it('shows alphabetical controls while retaining shared formatting controls', () => {
    const { onChangeAlphabeticalNameBasis } = renderModal({
      ...classTimeOptions,
      layout: 'alphabetical',
    })

    expect(screen.getByLabelText('Alphabetize by')).toHaveValue('last-name')
    expect(screen.getByText('Borders')).toBeInTheDocument()
    expect(screen.getByText('Font Size')).toBeInTheDocument()
    expect(screen.queryByText('Time Headers')).not.toBeInTheDocument()
    expect(screen.queryByText('Course Headers')).not.toBeInTheDocument()
    expect(screen.queryByText('Instructor Headers')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Alphabetize by'), { target: { value: 'first-name' } })
    expect(onChangeAlphabeticalNameBasis).toHaveBeenCalledWith('first-name')
  })

  it('keeps schematic cover settings in a collapsed disclosure', () => {
    renderModal(classTimeOptions, true)

    const summary = screen.getByText('Schematic Cover Settings')
    const disclosure = summary.closest('details')

    expect(disclosure).not.toHaveAttribute('open')
    fireEvent.click(summary)
    expect(disclosure).toHaveAttribute('open')
    expect(screen.getByText('Cover Orientation')).toBeInTheDocument()
  })
})
