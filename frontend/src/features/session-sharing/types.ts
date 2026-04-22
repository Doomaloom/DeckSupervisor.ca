import type { DbSessionEntry } from '../session-management/types'

export type OwnedSessionShareRecipient = {
  id: string
  first_name: string
  last_name: string
  email: string
}

export type ShareRecipient = OwnedSessionShareRecipient

export type OwnedSessionShareEntry = {
  id: string
  share_date: string
  session?: DbSessionEntry | null
  shared_with_profile?: OwnedSessionShareRecipient | null
  allow_roster_edits: boolean
  created_at: string
}

export type SessionShareCreateRequest = {
  session_id: string
  shared_with: string
  share_dates: string[]
  allow_roster_edits: boolean
  share_date?: string
}
