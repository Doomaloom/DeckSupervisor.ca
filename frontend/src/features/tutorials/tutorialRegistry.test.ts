import { describe, expect, it } from 'vitest'
import { tutorialRegistry } from './tutorialRegistry'
import { routeToTutorialId } from './tutorialRoutes'
import { tutorialSceneIds } from './scenes/sceneRegistry'

describe('tutorialRegistry', () => {
  it('includes the new prep workflow with the expected major sections', () => {
    const prepWorkflow = tutorialRegistry['prep-workflow']

    expect(prepWorkflow).toBeDefined()
    expect(prepWorkflow.steps.map(step => step.title)).toEqual([
      'Start from Home',
      'Upload CSV and choose an extracted session',
      'Confirm the session in Manage Sessions',
      'Customize the Schematic',
      'Review Rosters before printing',
      'Choose the right Print output',
      'Page overviews',
    ])
  })

  it('contains tutorials for all mapped routes', () => {
    const routeTutorialIds = [
      '/',
      '/manage-sessions',
      '/schematic',
      '/rosters',
      '/print',
      '/report-cards',
      '/staff-notes',
      '/share-sessions',
      '/team',
      '/account',
    ]
      .map(route => routeToTutorialId(route))
      .filter(Boolean)

    routeTutorialIds.forEach(tutorialId => {
      expect(tutorialRegistry[tutorialId!]).toBeDefined()
    })
  })

  it('keeps content complete and scenes resolvable', () => {
    Object.values(tutorialRegistry).forEach(tutorial => {
      expect(tutorial.title).toBeTruthy()
      expect(tutorial.shortDescription).toBeTruthy()
      expect(tutorial.steps.length).toBeGreaterThan(0)

      tutorial.steps.forEach(step => {
        if (step.kind === 'scene') {
          expect(tutorialSceneIds).toContain(step.sceneId)
        }
      })
    })
  })

  it('marks legacy split tutorials as hidden from the visible catalog', () => {
    expect(tutorialRegistry['upload-csv'].visibleInCatalog).toBe(false)
    expect(tutorialRegistry['start-session'].visibleInCatalog).toBe(false)
    expect(tutorialRegistry['custom-rosters'].visibleInCatalog).toBe(false)
  })
})
