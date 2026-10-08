import { useAuth } from "../../../app/AuthContext";

import { useCurrentSessionScopeSync } from "../../../shared/session-management/hooks/useCurrentSessionScopeSync";

import { useManageSessionForm } from "../../../shared/session-management/hooks/useManageSessionForm";

export function useManageSessionsLogic() {
    const { isGuest } = useAuth();
    const scopeSync = useCurrentSessionScopeSync();
    const form = useManageSessionForm({
        currentSessionId: scopeSync.currentSessionId,
        scopeVersion: scopeSync.scopeVersion,
        refreshScope: scopeSync.refreshScope,
        selectSessionAndSyncDay: scopeSync.selectSessionAndSyncDay,
    });

    return { view: "ready" as const, form, isGuest };

}
