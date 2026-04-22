import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import {
  createTeam,
  createTeamInvite,
  fetchMemberTeams,
  fetchOwnedTeams,
  fetchTeamDetails,
  leaveTeam,
  removeTeamMember,
  revokeTeamInvite,
  searchInvitableProfiles,
  updateTeam,
} from '../../lib/serverApi'
import { clearCurrentTeamId, getCurrentTeamId, setCurrentTeamId } from '../../lib/teamStorage'

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

  useEffect(() => {
    if (!user || accountType !== 'full_time') {
      return
    }
    const loadTeams = async () => {
      const response = await fetchOwnedTeams()
      const rows = (response.teams ?? []) as TeamEntry[]
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
      const response = await fetchMemberTeams()
      const rows = (response.teams ?? []) as { team_id: string; teams: TeamEntry | null }[]
      const nextTeams = rows.map(row => row.teams).filter(Boolean) as TeamEntry[]
      setMemberTeams(nextTeams)
    }
    void loadMemberTeams()
  }, [accountType, user])

  useEffect(() => {
    if (!activeTeamId || !user || accountType !== 'full_time') {
      return
    }
    const loadTeamDetails = async () => {
      const response = await fetchTeamDetails(activeTeamId)
      setInvites((response.invites ?? []) as InviteEntry[])
      setMembers((response.members ?? []) as MemberEntry[])
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
      const response = await createTeam({ name: teamName.trim(), available_locations: locations })
      const data = response.team as TeamEntry | undefined
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
      const response = await searchInvitableProfiles(activeTeamId, query)
      setSearchResults((response.results ?? []) as ProfileResult[])
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
      const response = await createTeamInvite(activeTeamId, profile.id)
      const data = response.invite
      if (data) {
        setInvites(current => [...current, data])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to invite user')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeInvite = async (invite: InviteEntry) => {
    setLoading(true)
    setMessage('')
    try {
      await revokeTeamInvite(invite.id)
      setInvites(current => current.filter(item => item.id !== invite.id))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to revoke invite')
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
      await updateTeam(activeTeamId, { available_locations: locations })
      setTeams(current =>
        current.map(team =>
          team.id === activeTeamId ? { ...team, available_locations: locations } : team,
        ),
      )
      setMessage('Locations updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update locations')
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
      await removeTeamMember(activeTeamId, member.user_id)
      setMembers(current => current.filter(item => item.user_id !== member.user_id))
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveMemberTeam = async (team: TeamEntry) => {
    setLoading(true)
    setMessage('')
    try {
      await leaveTeam(team.id)
      setMemberTeams(current => current.filter(item => item.id !== team.id))
      setMessage(`Left ${team.name}.`)
      if (getCurrentTeamId() === team.id) {
        clearCurrentTeamId()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to leave team')
    } finally {
      setLoading(false)
    }
  }

  if (isGuest) {
    return (
      <div id="team-page" data-component="team-page" className="mx-auto flex w-full max-w-xl flex-col gap-6">
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
      <div id="team-page" data-component="team-page" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-2xl font-semibold">My Team</h2>
          <p className="mt-2 text-sm text-secondary/70">
            View your teams and share sessions when you need coverage.
          </p>
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Teams</h3>
          {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
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
                  <button
                    type="button"
                    className="mt-3 rounded-lg border border-danger/60 px-3 py-1 text-sm font-semibold text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleLeaveMemberTeam(team)}
                    disabled={loading}
                  >
                    Leave Team
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h3 className="text-lg font-semibold">Share Sessions</h3>
          <p className="mt-2 text-sm text-secondary/70">
            Open the dedicated sharing workflow to schedule coverage, review exact dates, and revoke active shares.
          </p>
          <Link
            to="/share-sessions"
            className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          >
            Open Share Sessions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div id="team-page" data-component="team-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
