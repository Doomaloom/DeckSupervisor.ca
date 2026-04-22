import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useCsvImportFlow } from '../../app/CsvImportFlowContext'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { useTutorials } from '../tutorials/TutorialContext'
import FullTimeScopePanel from '../session-management/components/FullTimeScopePanel'
import NewSessionPanel from '../session-management/components/NewSessionPanel'
import SessionSelectionPanel from '../session-management/components/SessionSelectionPanel'
import { useCurrentSessionScopeSync } from '../session-management/hooks/useCurrentSessionScopeSync'
import { useDashboardScope } from '../session-management/hooks/useDashboardScope'
import { useNewSessionForm } from '../session-management/hooks/useNewSessionForm'
import { useSessionSelectionData } from '../session-management/hooks/useSessionSelectionData'
import type {
    DbSessionEntry,
    LocalSessionEntry,
    SharedSessionEntry,
} from '../session-management/types'

function DashboardPage() {
    const navigate = useNavigate()
    const { accountType, isGuest, user } = useAuth()
    const { requestCsvFile } = useCsvImportFlow()
    const { openTutorial } = useTutorials()
    const { teams, currentTeamId, setCurrentTeamId, loading: teamsLoading } = useCurrentTeam()
    const { currentTerm, currentTermKey, setCurrentTermKey, clearCurrentTerm } = useCurrentTerm()
    const [activePanel, setActivePanel] = useState<'options' | 'new-session' | 'select-session'>(
        'options',
    )
    const [selectMessage, setSelectMessage] = useState('')
    const scopeSync = useCurrentSessionScopeSync()
    const dashboardScope = useDashboardScope({
        accountType,
        currentTeamId,
        teams,
        currentTerm,
        currentTermKey,
        setCurrentTeamId,
        setCurrentTermKey,
        clearCurrentTerm,
        resetCurrentSessionScope: scopeSync.resetCurrentSessionScope,
    })
    const selectionData = useSessionSelectionData({
        isGuest,
        user,
        scopeVersion: scopeSync.scopeVersion,
        activePanel,
    })
    const newSessionForm = useNewSessionForm({
        accountType,
        isGuest,
        user,
        currentTeamId,
        currentTerm,
        teams,
        selectSessionAndSyncDay: scopeSync.selectSessionAndSyncDay,
        refreshScope: scopeSync.refreshScope,
    })

    const handleSelectLocalSession = (session: LocalSessionEntry) => {
        scopeSync.selectSessionAndSyncDay(session.id, session.sessionDay)
        setSelectMessage('Current session set.')
        navigate('/manage-sessions')
    }

    const handleSelectDbSession = (session: DbSessionEntry) => {
        scopeSync.selectSessionAndSyncDay(session.id, session.session_day)
        setSelectMessage('Current session set.')
        navigate('/manage-sessions')
    }

    const handleOpenSharedSession = (entry: SharedSessionEntry) => {
        if (!entry.sessions) {
            return
        }
        handleSelectDbSession(entry.sessions)
    }

    useEffect(() => {
        if (accountType === 'full_time' && activePanel !== 'options') {
            setActivePanel('options')
        }
    }, [accountType, activePanel])

    return (
        <div
            id="dashboard-page"
            data-component="dashboard-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            {accountType !== 'full_time' && activePanel !== 'options' ? (
                <button
                    type="button"
                    className="flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-primary"
                    onClick={() => setActivePanel('options')}
                >
                    ← Back
                </button>
            ) : null}
            <div className="flex min-h-[75vh] w-full flex-col items-center justify-center gap-6">
                {activePanel === 'options' ? (
                    <>
                        {accountType === 'full_time' ? (
                            <FullTimeScopePanel
                                currentTeamId={currentTeamId}
                                currentTerm={currentTerm}
                                teams={teams}
                                teamsLoading={teamsLoading}
                                teamTermSessionsLoading={dashboardScope.teamTermSessionsLoading}
                                selectedFullTimeYear={dashboardScope.selectedFullTimeYear}
                                fullTimeSessionTerms={dashboardScope.fullTimeSessionTerms}
                                fullTimeTermYears={dashboardScope.fullTimeTermYears}
                                fullTimeTermsForSelectedYear={dashboardScope.fullTimeTermsForSelectedYear}
                                seasonOptions={dashboardScope.seasonOptions}
                                onSelectTeam={dashboardScope.handleSelectFullTimeTeam}
                                onSelectYear={dashboardScope.handleSelectFullTimeYear}
                                onSelectSeason={dashboardScope.handleSelectFullTimeSeason}
                                onRequestCsvFile={requestCsvFile}
                            />
                        ) : null}
                        {accountType !== 'full_time' ? (
                            <>
                                <button
                                    type="button"
                                    className="w-80 rounded-card border-2 border-secondary bg-secondary px-8 py-10 text-center text-xl font-semibold text-accent shadow-md transition hover:-translate-y-0.5 hover:bg-primary"
                                    onClick={() => requestCsvFile()}
                                >
                                    Upload CSV and Choose Session
                                </button>
                                <button
                                    type="button"
                                    className="w-80 rounded-card border-2 border-secondary/20 bg-accent px-8 py-10 text-center text-xl font-semibold text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary"
                                    onClick={() => openTutorial('prep-workflow')}
                                >
                                    Help / Tutorials
                                </button>
                                <button
                                    type="button"
                                    className="w-80 rounded-card border-2 border-secondary/20 bg-accent px-8 py-10 text-center text-xl font-semibold text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary"
                                    onClick={() => setActivePanel('select-session')}
                                >
                                    Select Existing Session
                                </button>
                                {!isGuest ? (
                                    <button
                                        type="button"
                                        className="w-80 rounded-card border-2 border-secondary/20 bg-accent px-8 py-10 text-center text-xl font-semibold text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary"
                                        onClick={() => navigate('/share-sessions')}
                                    >
                                        Share Sessions
                                    </button>
                                ) : null}
                            </>
                        ) : null}
                    </>
                ) : activePanel === 'new-session' ? (
                    <NewSessionPanel form={newSessionForm} isGuest={isGuest} teams={teams} />
                ) : (
                    <SessionSelectionPanel
                        isGuest={isGuest}
                        sessions={selectionData.sessions}
                        sharedSessions={selectionData.sharedSessions}
                        currentSessionId={scopeSync.currentSessionId}
                        selectMessage={selectMessage}
                        onSelectLocalSession={handleSelectLocalSession}
                        onSelectDbSession={handleSelectDbSession}
                        onOpenSharedSession={handleOpenSharedSession}
                    />
                )}
            </div>
        </div>
    )
}

export default DashboardPage
