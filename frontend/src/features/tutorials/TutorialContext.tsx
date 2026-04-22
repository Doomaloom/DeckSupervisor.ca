import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { helpOverlayRegistry } from './helpOverlayRegistry'
import PageHelpOverlay from './PageHelpOverlay'
import PageHelpUnavailableNotice from './PageHelpUnavailableNotice'
import { routeToHelpOverlayId } from './helpOverlayRoutes'
import TutorialModal from './TutorialModal'
import { tutorialRegistry } from './tutorialRegistry'
import { routeToTutorialId } from './tutorialRoutes'
import type { HelpOverlayId } from './helpOverlayTypes'
import type { TutorialCatalogMode, TutorialId } from './types'

type TutorialContextValue = {
  isOpen: boolean
  activeTutorialId: TutorialId | null
  activeStepIndex: number
  openedFromPath: string
  catalogMode: TutorialCatalogMode
  openTutorialForPath: (pathname: string) => void
  openTutorial: (tutorialId: TutorialId, stepIndex?: number) => void
  openCatalog: (pathname?: string) => void
  closeTutorial: () => void
  nextStep: () => void
  previousStep: () => void
  setStep: (index: number) => void
  isPageHelpOpen: boolean
  activeOverlayId: HelpOverlayId | null
  activeOverlayTipId: string | null
  helpUnsupportedMessage: string | null
  openSidebarHelpForPath: (pathname: string) => void
  closePageHelp: () => void
  togglePageHelpForPath: (pathname: string) => void
  selectPageHelpTip: (tipId: string | null) => void
  nextPageHelpTip: () => void
  previousPageHelpTip: () => void
  clearHelpUnsupportedMessage: () => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

function clampStepIndex(tutorialId: TutorialId | null, index: number) {
  if (!tutorialId) {
    return 0
  }
  const steps = tutorialRegistry[tutorialId].steps
  return Math.min(Math.max(index, 0), steps.length - 1)
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [openedFromPath, setOpenedFromPath] = useState('/')
  const [catalogMode, setCatalogMode] = useState<TutorialCatalogMode>('current-page')
  const [isPageHelpOpen, setIsPageHelpOpen] = useState(false)
  const [activeOverlayId, setActiveOverlayId] = useState<HelpOverlayId | null>(null)
  const [activeOverlayTipId, setActiveOverlayTipId] = useState<string | null>(null)
  const [helpUnsupportedMessage, setHelpUnsupportedMessage] = useState<string | null>(null)

  const closeTutorial = () => {
    setIsOpen(false)
  }

  const closePageHelp = () => {
    setIsPageHelpOpen(false)
    setActiveOverlayId(null)
    setActiveOverlayTipId(null)
  }

  const clearHelpUnsupportedMessage = () => {
    setHelpUnsupportedMessage(null)
  }

  const openTutorial = (tutorialId: TutorialId, stepIndex = 0) => {
    closePageHelp()
    clearHelpUnsupportedMessage()
    setActiveTutorialId(tutorialId)
    setActiveStepIndex(clampStepIndex(tutorialId, stepIndex))
    setIsOpen(true)
  }

  const openCatalog = (pathname = '/') => {
    closePageHelp()
    clearHelpUnsupportedMessage()
    setOpenedFromPath(pathname)
    setCatalogMode('catalog')
    setActiveTutorialId(null)
    setActiveStepIndex(0)
    setIsOpen(true)
  }

  const openTutorialForPath = (pathname: string) => {
    closePageHelp()
    clearHelpUnsupportedMessage()
    setOpenedFromPath(pathname)
    const tutorialId = routeToTutorialId(pathname)
    if (tutorialId) {
      setCatalogMode('current-page')
      setActiveTutorialId(tutorialId)
      setActiveStepIndex(0)
      setIsOpen(true)
      return
    }

    setCatalogMode('current-page')
    setActiveTutorialId(null)
    setActiveStepIndex(0)
    setIsOpen(true)
  }

  const nextStep = () => {
    setActiveStepIndex(current => clampStepIndex(activeTutorialId, current + 1))
  }

  const previousStep = () => {
    setActiveStepIndex(current => clampStepIndex(activeTutorialId, current - 1))
  }

  const setStep = (index: number) => {
    setActiveStepIndex(clampStepIndex(activeTutorialId, index))
  }

  const getUnsupportedHelpMessage = (pathname: string) => {
    const overlayId = routeToHelpOverlayId(pathname)
    if (overlayId) {
      return helpOverlayRegistry[overlayId].unsupportedMessage ?? null
    }
    return 'Quick tips are not available on this page yet. Use Help / Tutorials on Home for the full prep walkthrough.'
  }

  const openSidebarHelpForPath = (pathname: string) => {
    const overlayId = routeToHelpOverlayId(pathname)
    if (!overlayId) {
      closePageHelp()
      setHelpUnsupportedMessage(getUnsupportedHelpMessage(pathname))
      return
    }

    closeTutorial()
    clearHelpUnsupportedMessage()
    setActiveOverlayId(overlayId)
    setActiveOverlayTipId(null)
    setIsPageHelpOpen(true)
  }

  const togglePageHelpForPath = (pathname: string) => {
    const overlayId = routeToHelpOverlayId(pathname)
    if (overlayId && isPageHelpOpen && activeOverlayId === overlayId) {
      closePageHelp()
      return
    }
    openSidebarHelpForPath(pathname)
  }

  const selectPageHelpTip = (tipId: string | null) => {
    setActiveOverlayTipId(tipId)
  }

  const getOrderedTipIds = () => {
    if (!activeOverlayId) {
      return []
    }
    return helpOverlayRegistry[activeOverlayId].tips
      .slice()
      .sort((left, right) => left.order - right.order)
      .map(tip => tip.id)
  }

  const nextPageHelpTip = () => {
    const tipIds = getOrderedTipIds()
    if (tipIds.length === 0) {
      return
    }

    if (!activeOverlayTipId) {
      setActiveOverlayTipId(tipIds[0])
      return
    }

    const currentIndex = tipIds.indexOf(activeOverlayTipId)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tipIds.length
    setActiveOverlayTipId(tipIds[nextIndex])
  }

  const previousPageHelpTip = () => {
    const tipIds = getOrderedTipIds()
    if (tipIds.length === 0) {
      return
    }

    if (!activeOverlayTipId) {
      setActiveOverlayTipId(tipIds[tipIds.length - 1])
      return
    }

    const currentIndex = tipIds.indexOf(activeOverlayTipId)
    const previousIndex =
      currentIndex === -1 ? tipIds.length - 1 : (currentIndex - 1 + tipIds.length) % tipIds.length
    setActiveOverlayTipId(tipIds[previousIndex])
  }

  useEffect(() => {
    closePageHelp()
    clearHelpUnsupportedMessage()
  }, [location.pathname])

  const value = useMemo<TutorialContextValue>(
    () => ({
      isOpen,
      activeTutorialId,
      activeStepIndex,
      openedFromPath,
      catalogMode,
      openTutorialForPath,
      openTutorial,
      openCatalog,
      closeTutorial,
      nextStep,
      previousStep,
      setStep,
      isPageHelpOpen,
      activeOverlayId,
      activeOverlayTipId,
      helpUnsupportedMessage,
      openSidebarHelpForPath,
      closePageHelp,
      togglePageHelpForPath,
      selectPageHelpTip,
      nextPageHelpTip,
      previousPageHelpTip,
      clearHelpUnsupportedMessage,
    }),
    [
      activeOverlayId,
      activeOverlayTipId,
      activeStepIndex,
      activeTutorialId,
      catalogMode,
      helpUnsupportedMessage,
      isOpen,
      isPageHelpOpen,
      openedFromPath,
    ],
  )

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialModal
        isOpen={isOpen}
        tutorialId={activeTutorialId}
        activeStepIndex={activeStepIndex}
        openedFromPath={openedFromPath}
        catalogMode={catalogMode}
        onClose={closeTutorial}
        onOpenTutorial={openTutorial}
        onSetStep={setStep}
        onNext={nextStep}
        onPrevious={previousStep}
      />
      <PageHelpOverlay
        isOpen={isPageHelpOpen}
        overlayId={activeOverlayId}
        activeTipId={activeOverlayTipId}
        onClose={closePageHelp}
        onSelectTip={selectPageHelpTip}
        onUnavailable={() => {
          const overlayId = activeOverlayId
          closePageHelp()
          setHelpUnsupportedMessage(
            overlayId
              ? helpOverlayRegistry[overlayId].unsupportedMessage ?? getUnsupportedHelpMessage(location.pathname)
              : getUnsupportedHelpMessage(location.pathname),
          )
        }}
      />
      <PageHelpUnavailableNotice
        message={helpUnsupportedMessage}
        onDismiss={clearHelpUnsupportedMessage}
      />
    </TutorialContext.Provider>
  )
}

export function useTutorials() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorials must be used within a TutorialProvider')
  }
  return context
}
