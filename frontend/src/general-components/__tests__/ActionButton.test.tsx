import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '../../test/render'
import { ActionButton } from '../components/ActionButton'

afterEach(cleanup)

describe('ActionButton', () => {
  it('defaults to type button and renders children', () => {
    render(<ActionButton>Save</ActionButton>)

    const button = screen.getByRole('button', { name: 'Save' })

    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveTextContent('Save')
  })

  it('supports disabled state', () => {
    render(<ActionButton disabled>Save</ActionButton>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('applies primary variant classes', () => {
    render(<ActionButton variant="primary">Save</ActionButton>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('bg-primary', 'text-white', 'hover:bg-secondary')
  })

  it('applies outline variant classes', () => {
    render(<ActionButton variant="outline">Cancel</ActionButton>)

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border', 'border-secondary/40', 'text-secondary')
  })

  it('applies danger variant classes', () => {
    render(<ActionButton variant="danger">Delete</ActionButton>)

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-danger', 'text-accent', 'hover:bg-dangerHover')
  })
})
