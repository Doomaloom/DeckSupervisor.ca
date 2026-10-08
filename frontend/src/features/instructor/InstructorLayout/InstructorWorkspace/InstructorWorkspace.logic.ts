import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../app/AuthContext";
import { useInstructorSession } from "../../session/InstructorSessionContext";
export function useInstructorWorkspaceLogic({ children }: { children: ReactNode }) {
    const { user, workflowCapabilities, signOut } = useAuth();
    const navigate = useNavigate();
    const [dirty, setDirty] = useState(false);
    const state = useInstructorSession();
    const location = useLocation();
    const session = state.session;
    useEffect(() => {
        const listener = (e: Event) =>
            setDirty((e as CustomEvent<boolean>).detail);
        window.addEventListener("instructor-draft", listener);
        return () => window.removeEventListener("instructor-draft", listener);
    }, []);
    return {
        view: "ready" as const,
        state,
        session,
        location,
        dirty,
        setDirty,
        workflowCapabilities,
        signOut,
        navigate,
        user,
        children,
    };

}

