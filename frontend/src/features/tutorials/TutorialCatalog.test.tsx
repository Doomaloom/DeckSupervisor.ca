import React from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { customRender, screen } from '../../test/render'
import TutorialCatalog from './TutorialCatalog'

describe('TutorialCatalog', () => {
  it('shows the prep workflow first and hides legacy split tutorials', async () => {
    const user = userEvent.setup()
    const onOpenTutorial = vi.fn()

    customRender(
      <TutorialCatalog
        mode="catalog"
        pathname="/session-planning"
        onOpenTutorial={onOpenTutorial}
      />,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons.some(button => (button.textContent ?? '').includes('Prep Workflow'))).toBe(true)
    expect(screen.queryByText('Custom Rosters')).not.toBeInTheDocument()
    expect(screen.queryByText('Upload CSV and Choose Session')).not.toBeInTheDocument()
    expect(screen.queryByText('Start New Session')).not.toBeInTheDocument()

    const prepWorkflowButtons = screen.getAllByRole('button', { name: /Prep Workflow/i })
    await user.click(prepWorkflowButtons[0])
    expect(onOpenTutorial).toHaveBeenCalledWith('prep-workflow')
  })
})
