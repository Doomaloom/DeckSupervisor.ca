import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { acceptTeamInvite, declineTeamInvite, fetchAccountData, leaveTeam } from '../../lib/serverApi'
import { clearCurrentTeamId, getCurrentTeamId } from '../../lib/teamStorage'

type InviteEntry = {
  id: string
  team_id: string
  status: string
  teams?: { name: string } | null
}

type MembershipEntry = {
  team_id: string
  role: string
  teams?: { name: string } | null
}

function AccountPage() {
  const { accountType, completeProfile, isGuest, profile, user } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [location, setLocation] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [teamMessage, setTeamMessage] = useState('')
  const [teamError, setTeamError] = useState('')
  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [memberships, setMemberships] = useState<MembershipEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setFirstName(profile?.first_name ?? '')
    setLastName(profile?.last_name ?? '')
    setLocation(profile?.location ?? '')
  }, [profile])

  useEffect(() => {
    if (!user) {
      return
    }
    const loadData = async () => {
      const data = await fetchAccountData()
      setInvites(data.invites ?? [])
      setMemberships(data.memberships ?? [])
    }
    void loadData()
  }, [user])

  const handleSaveProfile = async () => {
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    if (!trimmedFirst || !trimmedLast) {
      setSaveError('Please enter your first and last name.')
      return
    }
    setSaveError('')
    setSaveMessage('')
    setLoading(true)
    try {
      await completeProfile(trimmedFirst, trimmedLast, location.trim() || undefined)
      setSaveMessage('Profile updated.')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvite = async (invite: InviteEntry) => {
    if (!user) {
      return
    }
    setLoading(true)
    setInviteError('')
    try {
      await acceptTeamInvite(invite.id)
      const data = await fetchAccountData()
      setInvites(data.invites ?? [])
      setMemberships(data.memberships ?? [])
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to accept invite')
    } finally {
      setLoading(false)
    }
  }

  const handleDeclineInvite = async (invite: InviteEntry) => {
    setInviteError('')
    setLoading(true)
    try {
      await declineTeamInvite(invite.id)
      setInvites(current => current.filter(item => item.id !== invite.id))
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to decline invite')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveTeam = async (membership: MembershipEntry) => {
    setTeamMessage('')
    setTeamError('')
    setLoading(true)
    try {
      await leaveTeam(membership.team_id)
      setMemberships(current => current.filter(item => item.team_id !== membership.team_id))
      if (getCurrentTeamId() === membership.team_id) {
        clearCurrentTeamId()
      }
      setTeamMessage(`Left ${membership.teams?.name ?? 'team'}.`)
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : 'Failed to leave team')
    } finally {
      setLoading(false)
    }
  }

  if (isGuest) {
    return (
      <div id="account-page" data-component="account-page" className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <h2 className="text-xl font-semibold">Sign in to manage your account</h2>
          <p className="mt-2 text-sm text-secondary/70">
            You are currently using guest mode. Sign in to view invites and your teams.
          </p>
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

  return (
    <div id="account-page" data-component="account-page" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h2 className="text-2xl font-semibold">Account</h2>
        <p className="mt-2 text-sm text-secondary/70">
          Signed in as {profile?.email ?? user?.email}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary/70">
          {accountType === 'full_time' ? 'Full-time' : 'Part-time'}
        </p>
      </div>

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h3 className="text-lg font-semibold">Profile</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={firstName}
            onChange={event => setFirstName(event.target.value)}
            placeholder="First name"
          />
          <input
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={lastName}
            onChange={event => setLastName(event.target.value)}
            placeholder="Last name"
          />
          <input
            className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
            value={location}
            onChange={event => setLocation(event.target.value)}
            placeholder="Default work location"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary"
            onClick={handleSaveProfile}
            disabled={loading}
          >
            Save Profile
          </button>
          {saveMessage ? <span className="text-sm font-semibold text-secondary">{saveMessage}</span> : null}
          {saveError ? <span className="text-sm font-semibold text-danger">{saveError}</span> : null}
        </div>
      </div>

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h3 className="text-lg font-semibold">Invites</h3>
        {inviteError ? <p className="mt-3 text-sm font-semibold text-danger">{inviteError}</p> : null}
        {invites.length === 0 ? (
          <p className="mt-3 text-sm text-secondary/70">No pending invites.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {invites.map(invite => (
              <div key={invite.id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                <p className="font-semibold text-secondary">{invite.teams?.name ?? 'Team invite'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-secondary px-3 py-1 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    onClick={() => void handleAcceptInvite(invite)}
                    disabled={loading}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-secondary/40 px-3 py-1 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                    onClick={() => void handleDeclineInvite(invite)}
                    disabled={loading}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h3 className="text-lg font-semibold">My Teams</h3>
        {teamMessage ? <p className="mt-3 text-sm font-semibold text-secondary">{teamMessage}</p> : null}
        {teamError ? <p className="mt-3 text-sm font-semibold text-danger">{teamError}</p> : null}
        {memberships.length === 0 ? (
          <p className="mt-3 text-sm text-secondary/70">No teams joined yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {memberships.map(member => (
              <div key={member.team_id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                <p className="font-semibold text-secondary">{member.teams?.name ?? 'Team'}</p>
                <p className="text-xs uppercase tracking-wide text-secondary/70">{member.role}</p>
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-danger/60 px-3 py-1 text-sm font-semibold text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleLeaveTeam(member)}
                  disabled={loading || member.role.toLowerCase() === 'owner'}
                >
                  {member.role.toLowerCase() === 'owner' ? 'Owner' : 'Leave Team'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountPage
