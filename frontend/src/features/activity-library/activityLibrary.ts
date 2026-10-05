import catalog from './activities.json'
import { curriculumLevels } from '../instructor/lessonSkills'

export const activityCategories = ['Songs', 'Games', 'Drills', 'Workouts'] as const
export type ActivityCategory = typeof activityCategories[number]
export type LibraryActivity = {
  id: string
  category: ActivityCategory
  title: string
  instructions: string
  equipment?: string
  suitability?: string
  sourcePages: number[]
  skillIds: string[]
}

export const activities = catalog as LibraryActivity[]
export const librarySkills = curriculumLevels.flatMap(level => level.skills.map(skill => ({ ...skill, level: level.name })))

export function activityText(activity: LibraryActivity) {
  return [activity.title, activity.suitability && `Suitable for: ${activity.suitability}`,
    activity.equipment && `Equipment: ${activity.equipment}`, activity.instructions].filter(Boolean).join('\n\n')
}

export function filterActivities(query: string, category: ActivityCategory | 'All', skillId?: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return activities.filter(activity => {
    const text = `${activity.title} ${activity.instructions} ${activity.equipment || ''} ${activity.suitability || ''}`.toLocaleLowerCase()
    return (category === 'All' || activity.category === category)
      && (!skillId || activity.skillIds.includes(skillId)) && terms.every(term => text.includes(term))
  }).sort((a, b) => a.title.localeCompare(b.title))
}
