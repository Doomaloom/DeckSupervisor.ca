import { supabase } from './supabaseClient'

export type RosterLevelEdit = {
  code: string
  level: string
}

export type StudentLevelEdit = {
  code: string
  student_name_hash: string
  level: string
}

function normalizeName(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  let result = ''
  let lastWasSpace = false
  for (const char of trimmed) {
    const isLetter = /[a-z0-9]/.test(char)
    if (isLetter) {
      result += char
      lastWasSpace = false
      continue
    }
    if (!lastWasSpace) {
      result += ' '
      lastWasSpace = true
    }
  }
  return result.trim()
}

async function hashName(value: string): Promise<string> {
  const normalized = normalizeName(value)
  if (!normalized) {
    return ''
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function fetchRosterLevelEdits(sessionId: string): Promise<RosterLevelEdit[]> {
  const { data } = await supabase
    .from('roster_level_edits')
    .select('code,level')
    .eq('session_id', sessionId)
  return (data ?? []) as RosterLevelEdit[]
}

export async function fetchRosterStudentEdits(sessionId: string): Promise<StudentLevelEdit[]> {
  const { data } = await supabase
    .from('roster_student_level_edits')
    .select('code,student_name_hash,level')
    .eq('session_id', sessionId)
  return (data ?? []) as StudentLevelEdit[]
}

export async function upsertRosterLevelEdit(
  sessionId: string,
  createdBy: string,
  code: string,
  level: string,
) {
  return supabase.from('roster_level_edits').upsert(
    {
      session_id: sessionId,
      created_by: createdBy,
      code,
      level,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,code' },
  )
}

export async function upsertRosterStudentLevelEdit(
  sessionId: string,
  createdBy: string,
  code: string,
  studentName: string,
  level: string,
) {
  const hash = await hashName(studentName)
  if (!hash) {
    return null
  }
  return supabase.from('roster_student_level_edits').upsert(
    {
      session_id: sessionId,
      created_by: createdBy,
      code,
      student_name_hash: hash,
      level,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,code,student_name_hash' },
  )
}

export async function hashStudentNames(names: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    names.map(async name => ({ name, hash: await hashName(name) })),
  )
  const map = new Map<string, string>()
  entries.forEach(entry => {
    if (entry.hash) {
      map.set(entry.name, entry.hash)
    }
  })
  return map
}
