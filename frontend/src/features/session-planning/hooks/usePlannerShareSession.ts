import { useEffect, useMemo, useState } from 'react'
import type { NavigateFunction, Location } from 'react-router-dom'
import type { PlannerDataset, PlannerShareSession } from '../../../types/app'
import { getStoredItem, removeStoredItem, setStoredItem } from '../../../lib/browserStorage'
import {
  closePlannerShare,
  createPlannerShare,
  fetchPlannerShare,
  joinPlannerShare,
  leavePlannerShare,
} from '../../../lib/serverApi'

const SHARE_NAME_STORAGE_KEY = 'plannerShareDisplayName'
const SHARE_LOCATION_STORAGE_KEY = 'plannerShareLocationName'
const SHARE_PHONE_STORAGE_KEY = 'plannerSharePhoneNumber'

type UsePlannerShareSessionArgs = {
  location: Location
  navigate: NavigateFunction
  dataset: PlannerDataset | null
  setDataset: (dataset: PlannerDataset | null) => void
  setError: (error: string) => void
  loadLocalDataset: () => PlannerDataset | null
}

export function usePlannerShareSession({
  location,
  navigate,
  dataset,
  setDataset,
  setError,
  loadLocalDataset,
}: UsePlannerShareSessionArgs) {
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const shareCode = searchParams.get('share')?.trim().toUpperCase() ?? ''
  const isPopout = searchParams.get('popout') === '1'

  const [shareSession, setShareSession] = useState<PlannerShareSession | null>(null)
  const [shareParticipantId, setShareParticipantId] = useState('')
  const [shareDisplayName, setShareDisplayName] = useState('')
  const [shareLocationName, setShareLocationName] = useState('')
  const [sharePhoneNumber, setSharePhoneNumber] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [isSharingBusy, setIsSharingBusy] = useState(false)

  const isSharedMode = Boolean(shareCode && shareParticipantId && shareSession)
  const isShareHost = Boolean(isSharedMode && shareSession?.hostParticipantId === shareParticipantId)
  const shareStorageKey = shareCode ? `plannerShareParticipant:${shareCode}` : ''

  const applySharedSession = (session: PlannerShareSession) => {
    setShareSession(session)
    setDataset(session.dataset)
  }

  useEffect(() => {
    const storedName = getStoredItem(SHARE_NAME_STORAGE_KEY)
    if (storedName) {
      setShareDisplayName(storedName)
    }
    const storedLocationName = getStoredItem(SHARE_LOCATION_STORAGE_KEY)
    if (storedLocationName) {
      setShareLocationName(storedLocationName)
    }
    const storedPhoneNumber = getStoredItem(SHARE_PHONE_STORAGE_KEY)
    if (storedPhoneNumber) {
      setSharePhoneNumber(storedPhoneNumber)
    }
  }, [])

  useEffect(() => {
    if (shareDisplayName.trim()) {
      setStoredItem(SHARE_NAME_STORAGE_KEY, shareDisplayName.trim())
    }
  }, [shareDisplayName])

  useEffect(() => {
    if (shareLocationName.trim()) {
      setStoredItem(SHARE_LOCATION_STORAGE_KEY, shareLocationName.trim())
    }
  }, [shareLocationName])

  useEffect(() => {
    if (sharePhoneNumber.trim()) {
      setStoredItem(SHARE_PHONE_STORAGE_KEY, sharePhoneNumber.trim())
    }
  }, [sharePhoneNumber])

  useEffect(() => {
    if (!shareSession || !shareParticipantId) {
      setShareNotice('')
      return
    }
    setShareNotice(
      shareSession.hostParticipantId === shareParticipantId
        ? 'You are hosting this shared planner.'
        : `${shareSession.participants.find(participant => participant.isHost)?.displayName ?? 'Someone'} is hosting this shared planner.`,
    )
  }, [shareParticipantId, shareSession])

  useEffect(() => {
    if (!shareStorageKey) {
      setShareParticipantId('')
      setShareSession(null)
      return
    }
    const storedParticipantId = getStoredItem(shareStorageKey)
    if (storedParticipantId) {
      setShareParticipantId(storedParticipantId)
    }
  }, [shareStorageKey])

  useEffect(() => {
    if (!shareCode || !shareParticipantId) {
      return
    }
    let active = true
    const syncShare = async () => {
      try {
        const response = await fetchPlannerShare(shareCode, shareParticipantId)
        if (!active) {
          return
        }
        applySharedSession(response.session)
        setError('')
      } catch (shareError) {
        if (!active) {
          return
        }
        setShareSession(null)
        removeStoredItem(shareStorageKey)
        setShareParticipantId('')
        setError(shareError instanceof Error ? shareError.message : 'Failed to load shared planner.')
      }
    }
    void syncShare()
    const intervalId = window.setInterval(() => {
      void syncShare()
    }, 4000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [shareCode, shareParticipantId, shareStorageKey, setError])

  const syncQueryParams = (nextShareCode: string) => {
    const nextParams = new URLSearchParams(location.search)
    if (nextShareCode) {
      nextParams.set('share', nextShareCode)
    } else {
      nextParams.delete('share')
    }
    const nextSearch = nextParams.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }

  const startSharing = async () => {
    if (!dataset) {
      return
    }
    setIsSharingBusy(true)
    try {
      const nextDisplayName = shareDisplayName.trim() || 'Host'
      const response = await createPlannerShare({ dataset, displayName: nextDisplayName })
      setStoredItem(SHARE_NAME_STORAGE_KEY, nextDisplayName)
      setStoredItem(`plannerShareParticipant:${response.session.code}`, response.participantId)
      setShareParticipantId(response.participantId)
      applySharedSession(response.session)
      syncQueryParams(response.session.code)
      setError('')
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to start shared planner.')
    } finally {
      setIsSharingBusy(false)
    }
  }

  const joinSharedPlanner = async () => {
    if (!shareCode) {
      return
    }
    setIsSharingBusy(true)
    try {
      const nextDisplayName = shareDisplayName.trim() || 'Guest'
      const response = await joinPlannerShare(shareCode, { displayName: nextDisplayName })
      setStoredItem(SHARE_NAME_STORAGE_KEY, nextDisplayName)
      setStoredItem(`plannerShareParticipant:${shareCode}`, response.participantId)
      setShareParticipantId(response.participantId)
      applySharedSession(response.session)
      setError('')
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to join shared planner.')
    } finally {
      setIsSharingBusy(false)
    }
  }

  const leaveSharedPlannerSession = async () => {
    if (!shareCode || !shareParticipantId) {
      syncQueryParams('')
      return
    }
    setIsSharingBusy(true)
    try {
      await leavePlannerShare(shareCode, { participantId: shareParticipantId })
    } catch (shareError) {
      console.error('Failed to leave shared planner', shareError)
    } finally {
      removeStoredItem(`plannerShareParticipant:${shareCode}`)
      setShareParticipantId('')
      setShareSession(null)
      setShareNotice('')
      syncQueryParams('')
      setDataset(loadLocalDataset())
      setIsSharingBusy(false)
    }
  }

  const stopSharing = async () => {
    if (!shareCode || !shareParticipantId) {
      return
    }
    setIsSharingBusy(true)
    try {
      await closePlannerShare(shareCode, { participantId: shareParticipantId })
      removeStoredItem(`plannerShareParticipant:${shareCode}`)
      setShareParticipantId('')
      setShareSession(null)
      setShareNotice('')
      syncQueryParams('')
      setDataset(loadLocalDataset())
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to stop shared planner.')
    } finally {
      setIsSharingBusy(false)
    }
  }

  return {
    applySharedSession,
    isPopout,
    isSharedMode,
    isShareHost,
    isSharingBusy,
    joinSharedPlanner,
    leaveSharedPlannerSession,
    shareCode,
    shareDisplayName,
    shareLocationName,
    shareNotice,
    shareParticipantId,
    sharePhoneNumber,
    shareSession,
    startSharing,
    stopSharing,
    syncQueryParams,
    setShareDisplayName,
    setShareLocationName,
    setSharePhoneNumber,
  }
}
