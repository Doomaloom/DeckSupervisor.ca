import { useEffect, useMemo, useState } from 'react'
import {
  createSessionShares,
  fetchMySessions,
  fetchOwnedSessionShares,
  revokeSessionShare,
  searchSessionShareRecipients,
} from '../../../lib/serverApi'
import { getTorontoDate } from '../../../lib/torontoDate'
import { formatSessionDisplayName } from '../../../shared/session/sessionLabels'
import type { DbSessionEntry } from '../../session-management/types'
import { sortDbSessionsByStartDateDesc } from '../../session-management/utils/sessionIdentity'
import { resolveShareDates, type ShareDateMode } from '../shareDates'
import type {
  OwnedSessionShareEntry,
  ShareRecipient,
} from '../types'

type UseShareSessionsPageArgs = {
  enabled: boolean
  userId: string
}

function isSessionActiveToday(session: DbSessionEntry, today: string) {
  const startDate = session.start_date?.trim() ?? ''
  const endDate = session.end_date?.trim() ?? ''
  if (startDate && today < startDate) {
    return false
  }
  if (endDate && today > endDate) {
    return false
  }
  return true
}

export function useShareSessionsPage({ enabled, userId }: UseShareSessionsPageArgs) {
  const today = getTorontoDate()
  const [sessions, setSessions] = useState<DbSessionEntry[]>([])
  const [ownedShares, setOwnedShares] = useState<OwnedSessionShareEntry[]>([])
  const [recipientResults, setRecipientResults] = useState<ShareRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revokingShareId, setRevokingShareId] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<ShareRecipient | null>(null)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [dateMode, setDateMode] = useState<ShareDateMode>('single')
  const [singleDate, setSingleDate] = useState(today)
  const [rangeStartDate, setRangeStartDate] = useState(today)
  const [rangeEndDate, setRangeEndDate] = useState(today)
  const [allowRosterEdits, setAllowRosterEdits] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')

  const loadOwnedShares = async () => {
    const response = await fetchOwnedSessionShares()
    setOwnedShares(response.shares ?? [])
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [sessionsResponse, ownedSharesResponse] = await Promise.all([
          fetchMySessions(),
          fetchOwnedSessionShares(),
        ])
        if (!active) {
          return
        }
        const shareableSessions = ((sessionsResponse.sessions ?? []) as DbSessionEntry[]).filter(session =>
          isSessionActiveToday(session, today),
        )
        setSessions(sortDbSessionsByStartDateDesc(shareableSessions))
        setOwnedShares(ownedSharesResponse.shares ?? [])
      } catch (error) {
        if (!active) {
          return
        }
        setMessage(error instanceof Error ? error.message : 'Failed to load share sessions data.')
        setMessageTone('error')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [enabled, today])

  useEffect(() => {
    if (!enabled) {
      setRecipientResults([])
      return
    }
    const query = recipientSearch.trim()
    if (query.length < 2) {
      setRecipientResults([])
      setRecipientSearchLoading(false)
      return
    }

    let active = true
    const loadRecipients = async () => {
      setRecipientSearchLoading(true)
      try {
        const response = await searchSessionShareRecipients(query)
        if (!active) {
          return
        }
        setRecipientResults((response.results ?? []).filter(result => result.id !== userId))
      } catch (error) {
        if (!active) {
          return
        }
        setRecipientResults([])
        setMessage(error instanceof Error ? error.message : 'Failed to search users.')
        setMessageTone('error')
      } finally {
        if (active) {
          setRecipientSearchLoading(false)
        }
      }
    }

    void loadRecipients()
    return () => {
      active = false
    }
  }, [enabled, recipientSearch, userId])

  const selectedSession = sessions.find(session => session.id === selectedSessionId) ?? null

  const resolvedShareDates = resolveShareDates({
    mode: dateMode,
    singleDate,
    rangeStartDate,
    rangeEndDate,
    session: selectedSession,
    today,
  })

  const conflictingDates = useMemo(() => {
    if (!selectedSessionId || !selectedRecipient?.id || resolvedShareDates.dates.length === 0) {
      return []
    }
    const existingDates = new Set<string>()
    ownedShares.forEach(share => {
      if (share.session?.id !== selectedSessionId || share.shared_with_profile?.id !== selectedRecipient.id) {
        return
      }
      existingDates.add(share.share_date)
    })
    return resolvedShareDates.dates.filter(date => existingDates.has(date))
  }, [ownedShares, resolvedShareDates.dates, selectedRecipient?.id, selectedSessionId])

  const stepMessage =
    currentStep === 1
      ? selectedSession
        ? ''
        : 'Select a session to continue.'
      : currentStep === 2
        ? selectedRecipient
          ? ''
          : 'Search and select a user to continue.'
        : currentStep === 3
          ? resolvedShareDates.validationMessage
          : conflictingDates.length > 0
            ? `These dates are already shared: ${conflictingDates.join(', ')}`
            : resolvedShareDates.validationMessage

  const canContinue =
    currentStep === 1
      ? Boolean(selectedSession)
      : currentStep === 2
        ? Boolean(selectedRecipient)
        : currentStep === 3
          ? resolvedShareDates.validationMessage === '' && resolvedShareDates.dates.length > 0
          : false

  const canConfirmShare =
    Boolean(selectedSession) &&
    Boolean(selectedRecipient) &&
    resolvedShareDates.validationMessage === '' &&
    resolvedShareDates.dates.length > 0 &&
    conflictingDates.length === 0 &&
    !isSubmitting

  const resetWizard = () => {
    setCurrentStep(1)
    setSelectedSessionId('')
    setSelectedRecipient(null)
    setRecipientSearch('')
    setRecipientResults([])
    setDateMode('single')
    setSingleDate(today)
    setRangeStartDate(today)
    setRangeEndDate(today)
    setAllowRosterEdits(false)
  }

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSelectedRecipient(null)
    setRecipientSearch('')
    setRecipientResults([])
    setDateMode('single')
    setSingleDate(today)
    setRangeStartDate(today)
    setRangeEndDate(today)
    setAllowRosterEdits(false)
    setCurrentStep(1)
    setMessage('')
  }

  const handleSelectRecipient = (recipient: ShareRecipient) => {
    setSelectedRecipient(recipient)
    setCurrentStep(currentStep < 2 ? 2 : currentStep)
    setMessage('')
  }

  const handleNextStep = () => {
    if (!canContinue) {
      return
    }
    setCurrentStep(step => Math.min(4, step + 1))
  }

  const handlePreviousStep = () => {
    setCurrentStep(step => Math.max(1, step - 1))
  }

  const handleCreateShare = async () => {
    if (!canConfirmShare || !selectedSession || !selectedRecipient) {
      return
    }
    setIsSubmitting(true)
    setMessage('')
    try {
      await createSessionShares({
        session_id: selectedSession.id,
        shared_with: selectedRecipient.id,
        share_dates: resolvedShareDates.dates,
        allow_roster_edits: allowRosterEdits,
      })
      await loadOwnedShares()
      resetWizard()
      setMessage('Session shares scheduled.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to schedule session shares.')
      setMessageTone('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevokeShare = async (shareId: string) => {
    setRevokingShareId(shareId)
    setMessage('')
    try {
      await revokeSessionShare(shareId)
      await loadOwnedShares()
      setMessage('Session share revoked.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to revoke session share.')
      setMessageTone('error')
    } finally {
      setRevokingShareId('')
    }
  }

  const formatSessionLabel = (session: DbSessionEntry) =>
    formatSessionDisplayName({
      sessionDay: session.session_day,
      sessionSeason: session.session_season,
      sessionYear: session.session_year,
      startDate: session.start_date,
      sessionStartTime24: session.session_start_time24,
      sessionEndTime24: session.session_end_time24,
    })

  return {
    allowRosterEdits,
    canConfirmShare,
    canContinue,
    conflictingDates,
    currentStep,
    dateMode,
    formatSessionLabel,
    handleCreateShare,
    handleNextStep,
    handlePreviousStep,
    handleRevokeShare,
    handleSelectRecipient,
    handleSelectSession,
    isSubmitting,
    loading,
    message,
    messageTone,
    ownedShares,
    rangeEndDate,
    rangeStartDate,
    recipientResults,
    recipientSearch,
    recipientSearchLoading,
    resolvedShareDates,
    revokingShareId,
    selectedRecipient,
    selectedSession,
    selectedSessionId,
    sessions,
    setAllowRosterEdits,
    setCurrentStep,
    setDateMode,
    setRangeEndDate,
    setRangeStartDate,
    setRecipientSearch,
    setSingleDate,
    singleDate,
    stepMessage,
  }
}
