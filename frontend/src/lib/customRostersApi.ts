import type { CustomRoster, Student } from '../types/app'

type ResolveResponse = {
  rosters: CustomRoster[]
}

export async function resolveCustomRosters(
  day: string,
  students: Student[],
  accessToken: string,
): Promise<CustomRoster[]> {
  const response = await fetch('/api/custom-rosters/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
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
  roster: CustomRoster,
  students: Student[],
  accessToken: string,
): Promise<void> {
  const nameById = new Map(students.map(student => [student.id, student.name]))
  const studentNames = roster.studentIds
    .map(id => nameById.get(id))
    .filter((name): name is string => Boolean(name))

  const response = await fetch('/api/custom-rosters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
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

export async function deleteCustomRoster(id: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/custom-rosters/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to delete custom roster')
  }
}
