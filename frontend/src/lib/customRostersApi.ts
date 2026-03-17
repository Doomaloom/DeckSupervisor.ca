import type { CustomRoster, Student } from '../types/app'

type ResolveResponse = {
  rosters: CustomRoster[]
}

export async function resolveCustomRosters(
  day: string,
  sessionId: string,
  students: Student[],
): Promise<CustomRoster[]> {
  const response = await fetch('/api/custom-rosters/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      sessionId,
      day,
      students: students.map(student => ({ id: student.id, name: student.name })),
    }),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to load custom rosters')
  }
  const data = (await response.json()) as ResolveResponse
  return data.rosters ?? []
}

export async function saveCustomRoster(
  day: string,
  sessionId: string,
  roster: CustomRoster,
  students: Student[],
): Promise<void> {
  const nameById = new Map(students.map(student => [student.id, student.name]))
  const studentNames = roster.studentIds
    .map(id => nameById.get(id))
    .filter((name): name is string => Boolean(name))

  const response = await fetch('/api/custom-rosters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      sessionId,
      day,
      roster: {
        id: roster.id,
        serviceName: roster.serviceName,
        instructor: roster.instructor ?? '',
        sourceCodes: roster.sourceCodes,
        studentNames,
        createdAt: roster.createdAt,
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to save custom roster')
  }
}

export async function deleteCustomRoster(id: string, sessionId: string): Promise<void> {
  const response = await fetch(`/api/custom-rosters/${id}?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to delete custom roster')
  }
}
