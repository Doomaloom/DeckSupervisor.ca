import type { DbSessionEntry, LocalSessionEntry, SharedSessionEntry, } from "../types";

import { groupSessionListItemsByTerm } from "../utils/sessionCollections";

export type SessionSelectionPanelProps = {
    isGuest: boolean;
    sessions: Array<LocalSessionEntry | DbSessionEntry>;
    sharedSessions: SharedSessionEntry[];
    currentSessionId: string;
    selectMessage: string;
    onSelectLocalSession: (session: LocalSessionEntry) => void;
    onSelectDbSession: (session: DbSessionEntry) => void;
    onOpenSharedSession: (entry: SharedSessionEntry) => void;
};
export function useSessionSelectionPanelLogic({
    isGuest,
    sessions,
    sharedSessions,
    currentSessionId,
    selectMessage,
    onSelectLocalSession,
    onSelectDbSession,
    onOpenSharedSession,
}: SessionSelectionPanelProps) {
    const scrollContainerClassName =
        "mt-3 min-w-0 overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-4 shadow-md";
    const gridClassName = "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2";
    const scrollAreaClassName =
        "min-h-[20rem] max-h-[calc(100vh-14rem)] overflow-y-auto overflow-x-hidden pr-1";
    const groupedSessions = groupSessionListItemsByTerm(
        sessions.map((session) =>
            isGuest
                ? ({
                    kind: "local",
                    session: session as LocalSessionEntry,
                } as const)
                : ({ kind: "db", session: session as DbSessionEntry } as const)
        ),
    );

    return {
        view: "ready" as const,
        isGuest,
        sharedSessions,
        scrollContainerClassName,
        scrollAreaClassName,
        gridClassName,
        sessions,
        onOpenSharedSession,
        groupedSessions,
        currentSessionId,
        onSelectLocalSession,
        onSelectDbSession,
        selectMessage,
    };

}
