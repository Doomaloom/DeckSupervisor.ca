import {
  PARENT_FEEDBACK_TYPES,
  SAFETY_CONCERN_TYPES,
} from '../constants'
import type {
  InstructorTextEntry,
  ParentFeedbackType,
  SafetyConcernType,
  SessionReportData,
} from '../types'

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const toStringValue = (value: unknown) => (typeof value === 'string' ? value : '')

const toObjectArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(toRecord) : []

const mergeInstructorRows = (
  rows: InstructorTextEntry[],
  sessionInstructors: string[],
): InstructorTextEntry[] => {
  const byInstructor = new Map(
    rows
      .map(row => ({
        instructor: row.instructor.trim(),
        text: row.text,
      }))
      .filter(row => row.instructor)
      .map(row => [row.instructor, row.text]),
  )
  const next = sessionInstructors.map(instructor => ({
    instructor,
    text: byInstructor.get(instructor) ?? '',
  }))
  const extras = rows
    .map(row => ({ instructor: row.instructor.trim(), text: row.text }))
    .filter(row => row.instructor && !sessionInstructors.includes(row.instructor))
  return [...next, ...extras]
}

export const createEmptyReportData = (sessionInstructors: string[]): SessionReportData => ({
  staff: {
    performance: sessionInstructors.map(instructor => ({ instructor, text: '' })),
    strengthWeakness: sessionInstructors.map(instructor => ({ instructor, text: '' })),
    successionPlans: [],
    instructorCovers: [],
  },
  lessonStructure: {
    challengingTimes: [{ time: '', lessons: '', description: '' }],
    newClassLayouts: [],
  },
  safetyFacility: {
    safetyConcerns: [],
    maintenanceIssues: [],
    poolDeckWorksWell: [],
    poolDeckImprovements: [],
  },
  parentCustomerFeedback: [],
  projectsInitiatives: {
    adminWork: [],
    initiatives: [],
  },
})

export const normalizeSafetyConcernType = (value: unknown): SafetyConcernType => {
  if (typeof value === 'string' && SAFETY_CONCERN_TYPES.includes(value as SafetyConcernType)) {
    return value as SafetyConcernType
  }
  return 'supervision'
}

export const normalizeParentFeedbackType = (value: unknown): ParentFeedbackType => {
  if (typeof value === 'string' && PARENT_FEEDBACK_TYPES.includes(value as ParentFeedbackType)) {
    return value as ParentFeedbackType
  }
  return 'comment'
}

export const normalizeReportData = (value: unknown, sessionInstructors: string[]): SessionReportData => {
  const source = toRecord(value)
  const staff = toRecord(source.staff)
  const lessonStructure = toRecord(source.lessonStructure)
  const safetyFacility = toRecord(source.safetyFacility)
  const projectsInitiatives = toRecord(source.projectsInitiatives)

  const performance = toObjectArray(staff.performance)
    .map(item => ({
      instructor: toStringValue(item.instructor).trim(),
      text: toStringValue(item.text),
    }))
    .filter(item => item.instructor)

  const strengthWeakness = toObjectArray(staff.strengthWeakness)
    .map(item => ({
      instructor: toStringValue(item.instructor).trim(),
      text: toStringValue(item.text),
    }))
    .filter(item => item.instructor)

  const challengingTimes = toObjectArray(lessonStructure.challengingTimes)
    .map(item => ({
      time: toStringValue(item.time),
      lessons: toStringValue(item.lessons),
      description: toStringValue(item.description),
    }))
    .filter(item => item.time || item.lessons || item.description)

  return {
    staff: {
      performance: mergeInstructorRows(performance, sessionInstructors),
      strengthWeakness: mergeInstructorRows(strengthWeakness, sessionInstructors),
      successionPlans: toObjectArray(staff.successionPlans)
        .map(item => ({
          instructor: toStringValue(item.instructor).trim(),
          text: toStringValue(item.text),
        }))
        .filter(item => item.instructor),
      instructorCovers: toObjectArray(staff.instructorCovers)
        .map(item => ({
          instructor: toStringValue(item.instructor),
          coveredBy: toStringValue(item.coveredBy),
          details: toStringValue(item.details),
        }))
        .filter(item => item.instructor || item.coveredBy || item.details),
    },
    lessonStructure: {
      challengingTimes:
        challengingTimes.length > 0
          ? challengingTimes
          : [{ time: '', lessons: '', description: '' }],
      newClassLayouts: toObjectArray(lessonStructure.newClassLayouts)
        .map(item => ({
          level: toStringValue(item.level),
          description: toStringValue(item.description),
        }))
        .filter(item => item.level || item.description),
    },
    safetyFacility: {
      safetyConcerns: toObjectArray(safetyFacility.safetyConcerns)
        .map(item => ({
          concernType: normalizeSafetyConcernType(item.concernType),
          description: toStringValue(item.description),
        }))
        .filter(item => item.description),
      maintenanceIssues: toObjectArray(safetyFacility.maintenanceIssues)
        .map(item => ({
          item: toStringValue(item.item),
          description: toStringValue(item.description),
        }))
        .filter(item => item.item || item.description),
      poolDeckWorksWell: toObjectArray(safetyFacility.poolDeckWorksWell)
        .map(item => ({
          item: toStringValue(item.item),
          description: toStringValue(item.description),
        }))
        .filter(item => item.item || item.description),
      poolDeckImprovements: toObjectArray(safetyFacility.poolDeckImprovements)
        .map(item => ({
          item: toStringValue(item.item),
          description: toStringValue(item.description),
        }))
        .filter(item => item.item || item.description),
    },
    parentCustomerFeedback: toObjectArray(source.parentCustomerFeedback)
      .map(item => ({
        feedbackType: normalizeParentFeedbackType(item.feedbackType),
        description: toStringValue(item.description),
      }))
      .filter(item => item.description),
    projectsInitiatives: {
      adminWork: toObjectArray(projectsInitiatives.adminWork)
        .map(item => ({
          work: toStringValue(item.work),
          description: toStringValue(item.description),
        }))
        .filter(item => item.work || item.description),
      initiatives: toObjectArray(projectsInitiatives.initiatives)
        .map(item => ({
          title: toStringValue(item.title),
          brief: toStringValue(item.brief),
        }))
        .filter(item => item.title || item.brief),
    },
  }
}

export const defaultReportTitle = () => `Report - ${new Date().toLocaleString()}`

type StrengthWeaknessLists = {
  strengths: string[]
  weaknesses: string[]
}

const STRENGTHS_PREFIX = 'strengths:'
const WEAKNESSES_PREFIX = '|weaknesses:'
const WEAKNESSES_ONLY_PREFIX = 'weaknesses:'
const EMPTY_LIST_ITEM_TOKEN = '__EMPTY__'

const splitList = (value: string): string[] =>
  value === ''
    ? []
    : value
        .split('|')
        .map(item => (item === EMPTY_LIST_ITEM_TOKEN ? '' : item.trim()))

export const parseStrengthWeakness = (value: string): StrengthWeaknessLists => {
  const text = value.trim()
  if (!text) {
    return { strengths: [], weaknesses: [] }
  }

  if (text.startsWith(STRENGTHS_PREFIX)) {
    const weaknessIndex = text.indexOf(WEAKNESSES_PREFIX)
    if (weaknessIndex >= 0) {
      const strengthsPart = text.slice(STRENGTHS_PREFIX.length, weaknessIndex)
      const weaknessesPart = text.slice(weaknessIndex + WEAKNESSES_PREFIX.length)
      return {
        strengths: splitList(strengthsPart),
        weaknesses: splitList(weaknessesPart),
      }
    }
  }

  if (text.startsWith(WEAKNESSES_ONLY_PREFIX)) {
    return {
      strengths: [],
      weaknesses: splitList(text.slice(WEAKNESSES_ONLY_PREFIX.length)),
    }
  }

  return {
    strengths: [],
    weaknesses: [text],
  }
}

export const sanitizeStrengthWeaknessItem = (value: string) => value.replaceAll('|', '')

const encodeStrengthWeaknessItem = (value: string) => {
  const cleaned = sanitizeStrengthWeaknessItem(value).trim()
  return cleaned === '' ? EMPTY_LIST_ITEM_TOKEN : cleaned
}

export const serializeStrengthWeakness = ({ strengths, weaknesses }: StrengthWeaknessLists) => {
  const cleanStrengths = strengths.map(encodeStrengthWeaknessItem)
  const cleanWeaknesses = weaknesses.map(encodeStrengthWeaknessItem)

  if (cleanStrengths.length === 0 && cleanWeaknesses.length === 0) {
    return ''
  }

  return `strengths:${cleanStrengths.join('|')}|weaknesses:${cleanWeaknesses.join('|')}`
}
