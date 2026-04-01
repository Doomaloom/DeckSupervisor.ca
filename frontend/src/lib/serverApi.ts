import type {
  CsvSessionCandidate,
  ExtractedClass,
  PlannerCallRecordUpdate,
  PlannerClassMoveType,
  PlannerClassStatus,
  PlannerDataset,
  RequestAssignment,
  PlannerShareJoinResponse,
  PlannerShareSession,
} from '../types/app'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export type AccountDataResponse = {
  profile: {
    id: string
    email: string
    first_name: string
    last_name: string
    location?: string | null
    account_type: 'part_time' | 'full_time'
  }
  invites: Array<{
    id: string
    team_id: string
    status: string
    teams?: { name: string } | null
  }>
  memberships: Array<{
    team_id: string
    role: string
    teams?: { name: string } | null
  }>
}

export function fetchAccountData() {
  return request<AccountDataResponse>('/api/account')
}

export function updateProfile(body: { first_name: string; last_name: string; location?: string | null }) {
  return request<{ profile: AccountDataResponse['profile'] }>('/api/profile', {
    method: 'PUT',
    body,
  })
}

export function fetchCurrentTeams() {
  return request<{ teams: Array<{ id: string; name: string; available_locations: string[] }> }>('/api/teams/current')
}

export function fetchRequestAssignments(filters?: { term?: string; location?: string }) {
  const params = new URLSearchParams()
  if (filters?.term) {
    params.set('term', filters.term)
  }
  if (filters?.location) {
    params.set('location', filters.location)
  }
  const query = params.toString()
  return request<{ assignments: RequestAssignment[] }>(
    `/api/request-assignments${query ? `?${query}` : ''}`,
  )
}

export function createRequestAssignment(body: {
  eventId: string
  term: string
  location: string
  instructor: string
}) {
  return request<{ assignment: RequestAssignment }>('/api/request-assignments', {
    method: 'POST',
    body,
  })
}

export function updateRequestAssignment(
  id: string,
  body: {
    eventId?: string
    term?: string
    location?: string
    instructor?: string
  },
) {
  return request<{ assignment: RequestAssignment }>(`/api/request-assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteRequestAssignment(id: string) {
  return request<void>(`/api/request-assignments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchCurrentSession(sessionId: string) {
  return request<{
    session: {
      id: string
      team_id: string | null
      created_by: string
      session_day: string
      session_season: string | null
      session_year: number | null
      start_date: string | null
      end_date: string | null
      location: string | null
      source_locations: string[]
      session_start_time24: string | null
      session_end_time24: string | null
      instructors: { name: string }[]
    } | null
    access: {
      mode: 'guest' | 'owner' | 'shared' | 'none'
      allowRosterEdits: boolean
      shareDate?: string
    }
  }>(`/api/sessions/current/${encodeURIComponent(sessionId)}`)
}

export function fetchMySessions() {
  return request<{ sessions: any[] }>('/api/sessions/mine')
}

export function createSession(body: Record<string, unknown>) {
  return request<{ session: any }>('/api/sessions', { method: 'POST', body })
}

export function updateSession(sessionId: string, body: Record<string, unknown>) {
  return request<{ session: any }>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteSession(sessionId: string) {
  return request<void>(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export function fetchSharedSessionsToday() {
  return request<{ sharedSessions: any[] }>('/api/session-shares/today')
}

export function fetchTeamSessions(teamId: string, select?: string) {
  const params = new URLSearchParams()
  if (select) {
    params.set('select', select)
  }
  return request<{ sessions: any[] }>(`/api/teams/${encodeURIComponent(teamId)}/sessions?${params.toString()}`)
}

export async function fetchCsvSessionCandidates(
  file: File,
  scope?: { teamId?: string; termSeason?: string; termYear?: number }
) {
  const formData = new FormData()
  formData.append('csv_file', file)
  if (scope?.teamId) {
    formData.append('teamId', scope.teamId)
  }
  if (scope?.termSeason) {
    formData.append('termSeason', scope.termSeason)
  }
  if (scope?.termYear) {
    formData.append('termYear', String(scope.termYear))
  }

  const response = await fetch('/api/csv/session-candidates', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to inspect CSV')
  }

  return (await response.json()) as {
    sessions: CsvSessionCandidate[]
    classesBySession: Record<string, ExtractedClass[]>
  }
}

export function fetchOwnedTeams() {
  return request<{ teams: any[] }>('/api/teams/owned')
}

export function fetchMemberTeams() {
  return request<{ teams: any[] }>('/api/teams/member')
}

export function fetchTeamDetails(teamId: string) {
  return request<{ invites: any[]; members: any[] }>(`/api/teams/${encodeURIComponent(teamId)}/details`)
}

export function createTeam(body: Record<string, unknown>) {
  return request<{ team: any }>('/api/teams', { method: 'POST', body })
}

export function updateTeam(teamId: string, body: Record<string, unknown>) {
  return request<{ team: any[] }>(`/api/teams/${encodeURIComponent(teamId)}`, { method: 'PATCH', body })
}

export function fetchTeamMembers(teamId: string) {
  return request<{ members: any[] }>(`/api/teams/${encodeURIComponent(teamId)}/members`)
}

export function searchInvitableProfiles(teamId: string, query: string) {
  const params = new URLSearchParams({ q: query })
  return request<{ results: any[] }>(`/api/teams/${encodeURIComponent(teamId)}/invitable-profiles?${params.toString()}`)
}

export function createTeamInvite(teamId: string, inviteeId: string) {
  return request<{ invite: any }>(`/api/teams/${encodeURIComponent(teamId)}/invites`, {
    method: 'POST',
    body: { invitee_id: inviteeId },
  })
}

export function acceptTeamInvite(inviteId: string) {
  return request<void>(`/api/team-invites/${encodeURIComponent(inviteId)}/accept`, { method: 'POST' })
}

export function declineTeamInvite(inviteId: string) {
  return request<void>(`/api/team-invites/${encodeURIComponent(inviteId)}/decline`, { method: 'POST' })
}

export function revokeTeamInvite(inviteId: string) {
  return request<void>(`/api/team-invites/${encodeURIComponent(inviteId)}/revoke`, { method: 'POST' })
}

export function removeTeamMember(teamId: string, userId: string) {
  return request<void>(`/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export function createSessionShare(body: Record<string, unknown>) {
  return request<void>('/api/session-shares', { method: 'POST', body })
}

export function fetchSessionNotes(sessionId: string) {
  return request<{ notes: any[] }>(`/api/session-notes?sessionId=${encodeURIComponent(sessionId)}`)
}

export function createSessionNote(body: Record<string, unknown>) {
  return request<{ note: any }>('/api/session-notes', { method: 'POST', body })
}

export function updateSessionNote(id: string, body: Record<string, unknown>) {
  return request<{ note: any }>(`/api/session-notes/${encodeURIComponent(id)}`, { method: 'PATCH', body })
}

export function createPlannerShare(body: {
  dataset: PlannerDataset
  displayName: string
  locationOverrides: Record<string, string>
  callbackPhoneNumber: string
  ccEmail: string
}) {
  return request<PlannerShareJoinResponse>('/api/planner-shares', {
    method: 'POST',
    body,
  })
}

export function joinPlannerShare(code: string, body: { displayName: string }) {
  return request<PlannerShareJoinResponse>(`/api/planner-shares/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body,
  })
}

export function fetchPlannerShare(code: string, participantId: string) {
  const params = new URLSearchParams({ participantId })
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}?${params.toString()}`)
}

export function heartbeatPlannerShare(code: string, body: { participantId: string }) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/heartbeat`, {
    method: 'POST',
    body,
  })
}

export function leavePlannerShare(code: string, body: { participantId: string }) {
  return request<void>(`/api/planner-shares/${encodeURIComponent(code)}/leave`, {
    method: 'POST',
    body,
  })
}

export function closePlannerShare(code: string, body: { participantId: string }) {
  return request<void>(`/api/planner-shares/${encodeURIComponent(code)}/close`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareClassStatus(
  code: string,
  body: { participantId: string; classKey: string; status: PlannerClassStatus }
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/class-status`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareClassLanes(
  code: string,
  body: { participantId: string; classLaneIndexes: Record<string, number> }
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/class-lanes`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareClassMove(
  code: string,
  body: {
    participantId: string
    classKey: string
    plannedMoveType: PlannerClassMoveType
    plannedMoveTime: string
    plannedMoveTargetClassKey: string
  },
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/class-move`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareClassMetadata(
  code: string,
  body: { participantId: string; classKey: string; barcodeCancelledAt: string }
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/class-metadata`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareCallRecord(
  code: string,
  body: { participantId: string; participantRecordId: string; update: PlannerCallRecordUpdate }
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/call-record`, {
    method: 'POST',
    body,
  })
}

export function updatePlannerShareDetails(
  code: string,
  body: {
    participantId: string
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
    ccEmail: string
  }
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/details`, {
    method: 'POST',
    body,
  })
}

export function applyPlannerShareSaveState(
  code: string,
  body: {
    participantId: string
    classStatuses: Record<string, PlannerClassStatus>
    classLaneIndexes: Record<string, number>
    classMoves: Record<
      string,
      {
        plannedMoveType: PlannerClassMoveType
        plannedMoveTime: string
        plannedMoveTargetClassKey: string
      }
    >
    classBarcodeCancelledAt: Record<string, string>
    callRecords: Record<string, PlannerCallRecordUpdate>
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
  },
) {
  return request<{ session: PlannerShareSession }>(`/api/planner-shares/${encodeURIComponent(code)}/save-state`, {
    method: 'POST',
    body,
  })
}

export function deleteSessionNote(id: string) {
  return request<void>(`/api/session-notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchReportCardTotals(teamId: string, sessionLabel: string) {
  const params = new URLSearchParams({ session: sessionLabel, teamId })
  return request<{ totals: any[] }>(`/api/report-cards/totals?${params.toString()}`)
}

export function syncReportCards(body: Record<string, unknown>) {
  return request<{ status: 'synced' | 'blocked_unassigned' | 'empty' }>('/api/report-cards/sync', {
    method: 'POST',
    body,
  })
}

export function fetchSchematic(sessionId: string) {
  return request<{ schematic: { session_id: string; data: { codes?: string[]; instructors?: string[] } } | null }>(
    `/api/schematics/${encodeURIComponent(sessionId)}`,
  )
}

export function fetchSchematics(sessionIds: string[]) {
  const params = new URLSearchParams({ sessionIds: sessionIds.join(',') })
  return request<{ schematics: Array<{ session_id: string; data: { codes?: string[]; instructors?: string[] } | null }> }>(
    `/api/schematics?${params.toString()}`,
  )
}

export function upsertSchematic(sessionId: string, data: { codes: string[]; instructors: string[] }) {
  return request<{ schematic: any }>(`/api/schematics/${encodeURIComponent(sessionId)}`, {
    method: 'PUT',
    body: { data },
  })
}

export function fetchRosterEdits(sessionId: string) {
  return request<{
    rosterEdits: Array<{ code: string; level: string }>
    studentEdits: Array<{ code: string; student_name_hash: string; level: string }>
  }>(`/api/roster-edits?sessionId=${encodeURIComponent(sessionId)}`)
}

export function upsertRosterLevelEdit(body: Record<string, unknown>) {
  return request<void>('/api/roster-edits/level', { method: 'POST', body })
}

export function upsertRosterStudentLevelEdit(body: Record<string, unknown>) {
  return request<void>('/api/roster-edits/student', { method: 'POST', body })
}
