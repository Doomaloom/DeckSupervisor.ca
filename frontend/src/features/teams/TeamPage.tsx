import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { getTorontoDate } from '../../lib/torontoDate'
import { clearCurrentTeamId, setCurrentTeamId } from '../../lib/teamStorage'

type TeamEntry = {
  id: string
  name: string
  available_locations?: string[]
}

type ProfileResult = {
  id: string
  first_name: string
  last_name: string
  email: string
}

type InviteEntry = {
  id: string
  invitee_id: string
  status: string
  profiles?: { first_name: string; last_name: string; email: string } | null
}

type MemberEntry = {
  user_id: string
  role: string
  profiles?: { first_name: string; last_name: string; email: string } | null
}

type SessionEntry = {
  id: string
  team_id: string | null
  session_day: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
  end_date: string | null
}

const dayNames: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
}

function getSessionLabel(session: SessionEntry) {
  const dayLabel = session.session_day ? dayNames[session.session_day] ?? session.session_day : ''
  const season = session.session_season?.trim()
  const startYear = session.start_date ? new Date(session.start_date).getFullYear() : NaN
  const year = session.session_year ?? (Number.isFinite(startYear) && startYear > 0 ? startYear : null)
  const yearLabel = year ? String(year) : ''
  const parts = [dayLabel, season, yearLabel].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Session'
}

function TeamPage() {
  const { accountType, isGuest, user } = useAuth()
  const [teams, setTeams] = useState<TeamEntry[]>([])
  const [activeTeamId, setActiveTeamId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [locationsInput, setLocationsInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([])
  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [memberTeams, setMemberTeams] = useState<TeamEntry[]>([])
  const [userSessions, setUserSessions] = useState<SessionEntry[]>([])
  const [shareSessionId, setShareSessionId] = useState('')
  const [shareDate, setShareDate] = useState(() => getTorontoDate())
  const [shareMemberId, setShareMemberId] = useState('')
  const [shareAllowEdits, setShareAllowEdits] = useState(false)
  const [shareMembers, setShareMembers] = useState<MemberEntry[]>([])
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    if (!user || accountType !== 'full_time') {
      return
    }
    const loadTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id,name,available_locations')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
      const rows = data ?? []
      setTeams(rows)
      if (rows.length === 0) {
        setActiveTeamId('')
        clearCurrentTeamId()
        setLocationsInput('')
        return
      }
      const hasActive = rows.some(team => team.id === activeTeamId)
      if (!hasActive) {
        setActiveTeamId(rows[0].id)
        setCurrentTeamId(rows[0].id)
        setLocationsInput((rows[0].available_locations ?? []).join(', '))
      }
    }
    void loadTeams()
  }, [accountType, activeTeamId, user])

  useEffect(() => {
    if (!user || accountType === 'full_time') {
      return
    }
    const loadMemberTeams = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('team_id,teams(id,name,available_locations)')
        .eq('user_id', user.id)
      const rows = (data ?? []) as { team_id: string; teams: TeamEntry | null }[]
      const nextTeams = rows.map(row => row.teams).filter(Boolean) as TeamEntry[]
      setMemberTeams(nextTeams)
    }
    const loadSessions = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('id,team_id,session_day,session_season,session_year,start_date,end_date')
        .eq('created_by', user.id)
      setUserSessions((data ?? []) as SessionEntry[])
    }
    void loadMemberTeams()
    void loadSessions()
  }, [accountType, user])

  useEffect(() => {
    if (!activeTeamId || !user || accountType !== 'full_time') {
      return
    }
    const loadTeamDetails = async () => {
      const [{ data: inviteRows }, { data: memberRows }] = await Promise.all([
        supabase
          .from('team_invites')
          .select('id,invitee_id,status,profiles(first_name,last_name,email)')
          .eq('team_id', activeTeamId)
          .eq('status', 'pending'),
        supabase
          .from('team_members')
          .select('user_id,role,profiles(first_name,last_name,email)')
          .eq('team_id', activeTeamId),
      ])
      setInvites(inviteRows ?? [])
      setMembers(memberRows ?? [])
    }
    void loadTeamDetails()
  }, [accountType, activeTeamId, user])

  useEffect(() => {
    if (accountType !== 'full_time') {
      return
    }
    const activeTeam = teams.find(team => team.id === activeTeamId)
    setLocationsInput((activeTeam?.available_locations ?? []).join(', '))
  }, [accountType, activeTeamId, teams])

  const memberIds = useMemo(() => new Set(members.map(member => member.user_id)), [members])
  const invitedIds = useMemo(() => new Set(invites.map(invite => invite.invitee_id)), [invites])
  const shareableSessions = useMemo(() => userSessions.filter(session => Boolean(session.team_id)), [userSessions])

  useEffect(() => {
    if (!user || accountType === 'full_time' || !shareSessionId) {
      setShareMembers([])
      return
    }
    const session = shareableSessions.find(item => item.id === shareSessionId)
    if (!session || !session.team_id) {
      setShareMembers([])
      return
    }
    const loadMembers = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('user_id,role,profiles(first_name,last_name,email)')
        .eq('team_id', session.team_id)
      const rows = (data ?? []) as MemberEntry[]
      setShareMembers(rows.filter(member => member.user_id !== user.id))
    }
    void loadMembers()
  }, [accountType, shareSessionId, shareableSessions, user])

  const handleCreateTeam = async () => {
    if (!user || !teamName.trim()) {
      return
    }
    const locations = locationsInput
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({ name: teamName.trim(), owner_id: user.id, available_locations: locations })
        .select('id,name,available_locations')
        .single()
      if (error) {
        setMessage(error.message)
        return
      }
      if (data) {
        setTeams(current => [...current, data])
        setActiveTeamId(data.id)
        setCurrentTeamId(data.id)
        setTeamName('')
        setLocationsInput((data.available_locations ?? []).join(', '))
        setMessage('Team created.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([])
      return
    }
    if (!activeTeamId) {
      setMessage('Select a team first.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const query = searchQuery.trim()
      const { data, error } = await supabase.rpc('search_invitable_part_time_profiles', {
        p_team_id: activeTeamId,
        p_query: query,
        p_limit: 25,
      })
      if (error) {
        setMessage(error.message)
        return
      }
      setSearchResults((data ?? []) as ProfileResult[])
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (profile: ProfileResult) => {
    if (!activeTeamId) {
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('team_invites')
        .insert({ team_id: activeTeamId, invitee_id: profile.id, status: 'pending' })
        .select('id,invitee_id,status,profiles(first_name,last_name,email)')
        .single()
      if (error) {
        setMessage(error.message)
        return
      }
      if (data) {
        setInvites(current => [...current, data])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeInvite = async (invite: InviteEntry) => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('revoke_team_invite', { invite_id: invite.id })
      if (error) {
        setMessage(error.message)
        return
      }
      setInvites(current => current.filter(item => item.id !== invite.id))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLocations = async () => {
    if (!activeTeamId) {
      return
    }
    const locations = locationsInput
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('teams')
        .update({ available_locations: locations })
        .eq('id', activeTeamId)
      if (error) {
        setMessage(error.message)
        return
      }
      setTeams(current =>
        current.map(team =>
          team.id === activeTeamId ? { ...team, available_locations: locations } : team,
        ),
      )
      setMessage('Locations updated.')
    } finally {
      setLoading(false)
    }
  }

  const handleShareSession = async () => {
    if (!user || !shareSessionId || !shareMemberId || !shareDate) {
      setShareMessage('Select a session, teammate, and date.')
      return
    }
    setLoading(true)
    setShareMessage('')
    try {
      const { error } = await supabase.from('session_shares').insert({
        session_id: shareSessionId,
        share_date: shareDate,
        shared_by: user.id,
        shared_with: shareMemberId,
        allow_roster_edits: shareAllowEdits,
      })
      if (error) {
        setShareMessage(error.message)
        return
      }
      setShareMessage('Session shared.')
      setShareMemberId('')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (member: MemberEntry) => {
    if (!activeTeamId) {
      return
    }
    setLoading(true)
    try {
      await supabase
        .from('team_members')
        .delete()
        .eq('team_id', activeTeamId)
        .eq('user_id', member.user_id)
      setMembers(current => current.filter(item => item.user_id !== member.user_id))
    } finally {
      setLoading(false)
    }
  }

  if (isGuest) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-xl font-semibold">Sign in to manage teams</h2>
          <p className="mt-2 text-sm text-secondary/70">You must be signed in to invite team members.</p>
          <Link
            to="/sign-in"
            className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (accountType !== 'full_time') {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-2xl font-semibold">My Team</h2>
          <p className="mt-2 text-sm text-secondary/70">
            View your teams and share sessions when you need coverage.
          </p>
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Teams</h3>
          {memberTeams.length === 0 ? (
            <p className="mt-3 text-sm text-secondary/70">No team memberships found.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {memberTeams.map(team => (
                <div key={team.id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                  <p className="font-semibold text-secondary">{team.name}</p>
                  {team.available_locations?.length ? (
                    <p className="text-xs text-secondary/70">
                      Locations: {team.available_locations.join(', ')}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Share a session</h3>
          <p className="mt-2 text-sm text-secondary/70">
            Share a session for a specific date with a teammate covering your shift.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Session
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={shareSessionId}
                onChange={event => setShareSessionId(event.target.value)}
              >
                <option value="">Select a session</option>
                {shareableSessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {getSessionLabel(session)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Teammate
              <select
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                value={shareMemberId}
                onChange={event => setShareMemberId(event.target.value)}
              >
                <option value="">Select a teammate</option>
                {shareMembers.map(member => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.profiles?.first_name} {member.profiles?.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
              Share Date
              <input
                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                type="date"
                value={shareDate}
                onChange={event => setShareDate(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <input
                type="checkbox"
                checked={shareAllowEdits}
                onChange={event => setShareAllowEdits(event.target.checked)}
              />
              Allow roster edits
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
              onClick={handleShareSession}
              disabled={loading}
            >
              Share Session
            </button>
            {shareMessage ? <span className="text-sm font-semibold text-secondary">{shareMessage}</span> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h2 className="text-2xl font-semibold">Teams</h2>
        <p className="mt-2 text-sm text-secondary/70">Create teams and invite part-time staff.</p>
      </div>

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h3 className="text-lg font-semibold">Create a team</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={teamName}
            onChange={event => setTeamName(event.target.value)}
            placeholder="Team name"
          />
          <input
            className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={locationsInput}
            onChange={event => setLocationsInput(event.target.value)}
            placeholder="Locations (comma separated)"
          />
          <button
            type="button"
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
            onClick={handleCreateTeam}
            disabled={loading}
          >
            Create
          </button>
        </div>
        {message ? <p className="mt-2 text-sm font-semibold text-secondary">{message}</p> : null}
      </div>

      {teams.length === 0 ? (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-sm text-secondary/70">No teams created yet.</p>
        </div>
      ) : (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Manage team</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              value={activeTeamId}
              onChange={event => {
                const nextId = event.target.value
                setActiveTeamId(nextId)
                setCurrentTeamId(nextId)
              }}
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
              value={locationsInput}
              onChange={event => setLocationsInput(event.target.value)}
              placeholder="Locations (comma separated)"
            />
            <button
              type="button"
              className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
              onClick={handleUpdateLocations}
              disabled={loading || !activeTeamId}
            >
              Update Locations
            </button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-base font-semibold">Invite by name</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search first or last name"
                />
                <button
                  type="button"
                  className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                  onClick={handleSearch}
                  disabled={loading}
                >
                  Search
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-secondary/70">No results yet.</p>
                ) : (
                  searchResults.map(result => {
                    const alreadyMember = memberIds.has(result.id)
                    const alreadyInvited = invitedIds.has(result.id)
                    return (
                      <div key={result.id} className="rounded-2xl border border-secondary/20 bg-bg p-3">
                        <p className="font-semibold text-secondary">
                          {result.first_name} {result.last_name}
                        </p>
                        <p className="text-xs text-secondary/70">{result.email}</p>
                        <button
                          type="button"
                          className="mt-2 rounded-lg border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleInvite(result)}
                          disabled={loading || alreadyMember || alreadyInvited}
                        >
                          {alreadyMember ? 'Already in team' : alreadyInvited ? 'Invite sent' : 'Invite'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold">Pending invites</h4>
              {invites.length === 0 ? (
                <p className="mt-3 text-sm text-secondary/70">No pending invites.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {invites.map(invite => (
                    <div key={invite.id} className="rounded-2xl border border-secondary/20 bg-bg p-3">
                      <p className="font-semibold text-secondary">
                        {invite.profiles?.first_name} {invite.profiles?.last_name}
                      </p>
                      <p className="text-xs text-secondary/70">{invite.profiles?.email}</p>
                      <button
                        type="button"
                        className="mt-2 rounded-lg border border-danger/60 px-3 py-1 text-sm font-semibold text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent"
                        onClick={() => void handleRevokeInvite(invite)}
                        disabled={loading}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="mt-6 text-base font-semibold">Team members</h4>
              {members.length === 0 ? (
                <p className="mt-3 text-sm text-secondary/70">No members yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {members.map(member => {
                    const isSelf = member.user_id === user?.id
                    return (
                      <div key={member.user_id} className="rounded-2xl border border-secondary/20 bg-bg p-3">
                        <p className="font-semibold text-secondary">
                          {member.profiles?.first_name} {member.profiles?.last_name}
                        </p>
                        <p className="text-xs text-secondary/70">{member.profiles?.email}</p>
                        <button
                          type="button"
                          className="mt-2 rounded-lg border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleRemoveMember(member)}
                          disabled={loading || isSelf}
                        >
                          {isSelf ? 'Owner' : 'Remove'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamPage
