export type SessionSourceLocationShape = {
  location?: string | null
  source_locations?: string[] | null
}

export function normalizeSessionLocation(value: string | null | undefined) {
  return (value ?? '').trim()
}

export function normalizeSessionLocationKey(value: string | null | undefined) {
  return normalizeSessionLocation(value).toLowerCase()
}

export function normalizeSessionLocations(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach(value => {
    const trimmed = normalizeSessionLocation(value)
    if (!trimmed) {
      return
    }
    const key = normalizeSessionLocationKey(trimmed)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(trimmed)
  })

  return result
}

export function getEffectiveSourceLocations(session: SessionSourceLocationShape | null | undefined) {
  if (!session) {
    return [] as string[]
  }
  const normalized = normalizeSessionLocations(session.source_locations ?? [])
  if (normalized.length > 0) {
    return normalized
  }
  return normalizeSessionLocations([session.location ?? ''])
}

export function sessionIncludesSourceLocation(
  session: SessionSourceLocationShape | null | undefined,
  rawLocation: string | null | undefined,
) {
  const rawKey = normalizeSessionLocationKey(rawLocation)
  if (!rawKey) {
    return false
  }
  return getEffectiveSourceLocations(session).some(location => normalizeSessionLocationKey(location) === rawKey)
}
