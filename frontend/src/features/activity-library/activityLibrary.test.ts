import { expect, it } from 'vitest'
import { activities, activityCategories, activityText, filterActivities, librarySkills } from './activityLibrary'
import { textSegments } from '../pdf/lessonPlan/LessonPlanDocument'

it('contains the reviewed source inventory with valid skill links and bounded lesson text', () => {
  expect(Object.fromEntries(activityCategories.map(category => [category, activities.filter(a => a.category === category).length])))
    .toEqual({ Songs: 37, Games: 4, Drills: 66, Workouts: 14 })
  expect(new Set(activities.map(a => a.id)).size).toBe(activities.length)
  const skills = new Set(librarySkills.map(skill => skill.id))
  for (const activity of activities) {
    expect(activityCategories).toContain(activity.category)
    expect(activity.title.trim()).not.toBe('')
    expect(activity.instructions.trim()).not.toBe('')
    expect(activity.sourcePages.length).toBeGreaterThan(0)
    expect(activity.sourcePages.every(page => Number.isInteger(page) && page >= 1 && page <= 24)).toBe(true)
    expect(activity.skillIds.every(id => skills.has(id))).toBe(true)
    expect(new Set(activity.skillIds).size).toBe(activity.skillIds.length)
    expect(activityText(activity).length).toBeLessThanOrEqual(10000)
    expect(textSegments(activityText(activity), 38).join('')).toBe(activityText(activity))
  }
})

it('combines case-insensitive text, category, and explicit skill matches', () => {
  const result = filterActivities('  TORPEDO kicking  ', 'Drills', 'Splash1:9')
  expect(result.map(a => a.title)).toEqual(['Front crawl: Torpedo kicking'])
  expect(filterActivities('torpedo', 'Songs', 'Splash1:9')).toEqual([])
  expect(filterActivities('torpedo', 'Drills', 'Splash5:7')).toEqual([])
  expect(filterActivities('buoyancy', 'All').length).toBeGreaterThan(0)
  expect(filterActivities('', 'All', 'unknown')).toEqual([])
})

it('does not recommend advanced drills for beginners or guess mappings for generic songs', () => {
  expect(filterActivities('Closed fists', 'Drills', 'Splash1:10-front-crawl-wearing-pfd-5-m')).toEqual([])
  expect(filterActivities('Closed fists', 'Drills', 'Splash5:8-front-crawl')).toHaveLength(1)
  expect(filterActivities('Clean up', 'Songs')).toHaveLength(1)
  expect(filterActivities('Clean up', 'Songs', 'Splash1:5')).toEqual([])
})

it('retains cross-page actions and the verified workout intervals', () => {
  const lion = activities.find(a => a.title === 'Going on a Lion Hunt (2)')!
  expect(lion.sourcePages).toEqual([1, 2])
  expect(lion.instructions).toContain('Push water down')
  const workout = activities.find(a => a.title === '13-18 years: Main set A')!
  expect(workout.instructions).toContain('3 × 100 m front crawl; start every 2:45.')
  expect(workout.instructions).toContain('2 × 100 m front crawl; start every 2:35.')
  expect(workout.instructions).toContain('1 × 100 m front crawl sprint.')
  expect(activities.find(a => a.title === 'Breaststroke: Shooters')!.instructions).toContain('drive the arms forward quickly')
})
