import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { supabase } from '../../lib/supabaseClient'

type TeamEntry = {
  id: string
  name: string
}

type ProfileResult = {
  id: string
  first_name: string
  last_name: string
  email: string
  account_type: 'part_time' | 'full_time'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([])
  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user || accountType !== 'full_time') {
      return
    }
    const loadTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id,name')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
      const rows = data ?? []
      setTeams(rows)
      if (rows.length === 0) {
        setActiveTeamId('')
        return
      }
      const hasActive = rows.some(team => team.id === activeTeamId)
      if (!hasActive) {
        setActiveTeamId(rows[0].id)
      }
    }
    void loadTeams()
  }, [accountType, activeTeamId, user])

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

  const memberIds = useMemo(() => new Set(members.map(member => member.user_id)), [members])
  const invitedIds = useMemo(() => new Set(invites.map(invite => invite.invitee_id)), [invites])

  const handleCreateTeam = async () => {
    if (!user || !teamName.trim()) {
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({ name: teamName.trim(), owner_id: user.id })
        .select('id,name')
        .single()
      if (error) {
        setMessage(error.message)
        return
      }
      if (data) {
        setTeams(current => [...current, data])
        setActiveTeamId(data.id)
        setTeamName('')
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
    setLoading(true)
    setMessage('')
    try {
      const query = searchQuery.trim()
      const { data, error } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,email,account_type')
        .eq('account_type', 'part_time')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      if (error) {
        setMessage(error.message)
        return
      }
      setSearchResults((data ?? []).filter(profile => profile.id !== user.id))
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
    try {
      await supabase.from('team_invites').update({ status: 'revoked' }).eq('id', invite.id)
      setInvites(current => current.filter(item => item.id !== invite.id))
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
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-xl font-semibold">Full-time access only</h2>
          <p className="mt-2 text-sm text-secondary/70">
            Only full-time accounts can manage teams and send invites.
          </p>
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
              onChange={event => setActiveTeamId(event.target.value)}
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
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
