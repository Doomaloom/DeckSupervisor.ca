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
  const view = customRender(
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
  return { onChangeLayout, onChangeAlphabeticalNameBasis, view }
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

  it('opens schematic cover options independently from the other groups', () => {
    renderModal(classTimeOptions, true)

    const coverGroupButton = screen.getByRole('button', { name: 'Schematic Coverpage' })
    expect(
      coverGroupButton.compareDocumentPosition(screen.getByText('Format Options'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByLabelText('Masterlist layout')).toBeInTheDocument()
    fireEvent.click(coverGroupButton)

    expect(screen.getByLabelText('Masterlist layout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Format Options' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Time Header Style' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Course Header Style' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Include Schematic Coverpage')).toBeInTheDocument()
    expect(screen.getByText('Cover Orientation')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Format Options' }))
    expect(screen.queryByLabelText('Masterlist layout')).not.toBeInTheDocument()
    expect(screen.getByText('Cover Orientation')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Schematic Coverpage' }))
    expect(screen.queryByText('Cover Orientation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Format Options' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('allows every option group to minimize independently', () => {
    renderModal(classTimeOptions)

    for (const title of ['Format Options', 'Time Header Style', 'Course Header Style']) {
      const groupButton = screen.getByRole('button', { name: title })
      expect(groupButton).toHaveAttribute('aria-expanded', 'true')
      fireEvent.click(groupButton)
      expect(groupButton).toHaveAttribute('aria-expanded', 'false')
      expect(groupButton.closest('[data-options-group]')).toHaveClass('h-12')
      fireEvent.click(groupButton)
      expect(groupButton).toHaveAttribute('aria-expanded', 'true')
    }
  })

  it('uses a fixed-height modal with a scrollable options column', () => {
    const { view } = renderModal(classTimeOptions)
    const optionsColumn = view.container.querySelector('[data-component="masterlist-option-groups"]')

    expect(optionsColumn).toHaveClass('overflow-y-auto')
    expect(optionsColumn?.parentElement?.parentElement).toHaveClass(
      'h-[min(52rem,calc(100vh-3rem))]',
      'overflow-hidden',
    )
  })
})
