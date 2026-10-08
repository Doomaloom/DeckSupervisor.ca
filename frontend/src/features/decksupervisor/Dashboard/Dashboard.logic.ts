import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../app/AuthContext";

import { useCsvImportFlow } from "../../../app/CsvImportFlowContext";

import { useCurrentTeam } from "../../../app/useCurrentTeam";

import { useCurrentTerm } from "../../../app/useCurrentTerm";

import { useCurrentSessionScopeSync } from "../../../shared/session-management/hooks/useCurrentSessionScopeSync";

import { useDashboardScope } from "../../../shared/session-management/hooks/useDashboardScope";

import { useNewSessionForm } from "../../../shared/session-management/hooks/useNewSessionForm";

import { useSessionSelectionData } from "../../../shared/session-management/hooks/useSessionSelectionData";

import type { DbSessionEntry, LocalSessionEntry, SharedSessionEntry, } from "../../../shared/session-management/types";

export function useDashboardLogic() {
    const navigate = useNavigate();
    const { accountType, isGuest, user } = useAuth();
    const { requestCsvFile } = useCsvImportFlow();
    const { teams, currentTeamId, setCurrentTeamId, loading: teamsLoading } =
        useCurrentTeam();
    const { currentTerm, currentTermKey, setCurrentTermKey, clearCurrentTerm } =
        useCurrentTerm();
    const [activePanel, setActivePanel] = useState<
        "options" | "new-session" | "select-session"
    >(
        "options",
    );
    const [selectMessage, setSelectMessage] = useState("");
    const scopeSync = useCurrentSessionScopeSync();
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
    });
    const selectionData = useSessionSelectionData({
        isGuest,
        user,
        scopeVersion: scopeSync.scopeVersion,
        activePanel,
    });
    const newSessionForm = useNewSessionForm({
        accountType,
        isGuest,
        user,
        currentTeamId,
        currentTerm,
        teams,
        selectSessionAndSyncDay: scopeSync.selectSessionAndSyncDay,
        refreshScope: scopeSync.refreshScope,
    });

    const handleSelectLocalSession = (session: LocalSessionEntry) => {
        scopeSync.selectSessionAndSyncDay(session.id, session.sessionDay);
        setSelectMessage("Current session set.");
        navigate("/manage-sessions");
    };

    const handleSelectDbSession = (session: DbSessionEntry) => {
        scopeSync.selectSessionAndSyncDay(session.id, session.session_day);
        setSelectMessage("Current session set.");
        navigate("/manage-sessions");
    };

    const handleOpenSharedSession = (entry: SharedSessionEntry) => {
        if (!entry.sessions) {
            return;
        }
        handleSelectDbSession(entry.sessions);
    };

    useEffect(() => {
        if (accountType === "full_time" && activePanel !== "options") {
            setActivePanel("options");
        }
    }, [accountType, activePanel]);

    return {
        view: "ready" as const,
        accountType,
        activePanel,
        setActivePanel,
        currentTeamId,
        currentTerm,
        teams,
        teamsLoading,
        dashboardScope,
        requestCsvFile,
        newSessionForm,
        isGuest,
        selectionData,
        scopeSync,
        selectMessage,
        handleSelectLocalSession,
        handleSelectDbSession,
        handleOpenSharedSession,
    };

}
