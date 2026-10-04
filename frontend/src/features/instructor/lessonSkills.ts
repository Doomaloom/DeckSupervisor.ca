import levels from './lessonSkills.json'
import { sanitizeLevel } from '../rosters/utils'

export const curriculumLevels = levels.filter(level => level.skills.length > 0)

export function findCurriculumLevel(value: string) {
  if (!value.trim()) return undefined
  const id = sanitizeLevel(value)
  return curriculumLevels.find(level => level.id.toLowerCase() === id.toLowerCase())
}
