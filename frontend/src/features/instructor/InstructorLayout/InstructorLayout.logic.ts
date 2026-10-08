import { type ReactNode } from "react";

import { useAuth } from "../../../app/AuthContext";

export function useInstructorLayoutLogic({ children }: { children: ReactNode }) {
    const { user, loading, workflowCapabilities } = useAuth();
    if (loading) {
        return { view: "loading" as const };
    }
    if (!user) {
        return { view: "signedOut" as const };
    }
    if (!workflowCapabilities.instructor) {
        return { view: "unavailable" as const };
    }
    return { view: "ready" as const, user, children };

}
