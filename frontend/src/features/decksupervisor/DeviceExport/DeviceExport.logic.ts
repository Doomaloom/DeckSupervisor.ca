import { useEffect, useState } from "react";

import { useAuth } from "../../../app/AuthContext";

import { useCurrentSession } from "../../../app/useCurrentSession";

import { getStorageScope, onStorageScopeChanged } from "../../../lib/storageScope";

export const panel =
    "rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md";

export const message = (error: unknown) =>
    error instanceof Error
        ? error.message
        : "Unable to prepare the export. Please try again.";
export function useDeviceExportLogic() {
    const { session, sessionId, loading } = useCurrentSession();
    const { isGuest } = useAuth();
    const [scope, setScope] = useState(getStorageScope);
    useEffect(() => onStorageScopeChanged(setScope), []);
    if (loading || (session && session.id !== sessionId)) {
        return { view: "loading" as const };
    }
    if (!session || !sessionId) {
        return { view: "empty" as const };
    }
    return {
        view: "ready" as const,
        scope,
        sessionId,
        session,
        isGuest,
    };

}
