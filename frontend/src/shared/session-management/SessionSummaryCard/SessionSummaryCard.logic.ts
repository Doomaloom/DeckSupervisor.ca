import { formatSessionDisplayName } from "../../session/sessionLabels";

import { getEffectiveSourceLocations } from "../../session/sourceLocations";

import type { DbSessionEntry, LocalSessionEntry } from "../types";

export type SessionSummaryCardProps = {
    isGuest: boolean;
    currentSession: LocalSessionEntry | DbSessionEntry | null;
    teamName?: string;
};
export function useSessionSummaryCardLogic({
    isGuest,
    currentSession,
    teamName = "",
}: SessionSummaryCardProps) {
    if (!currentSession) {
        return { view: "hidden" as const };
    }

    const title = isGuest
        ? formatSessionDisplayName({
            sessionDay: (currentSession as LocalSessionEntry).sessionDay,
            sessionSeason: (currentSession as LocalSessionEntry).sessionSeason,
            sessionYear: (currentSession as LocalSessionEntry).sessionYear ??
                null,
            startDate: (currentSession as LocalSessionEntry).startDate,
            sessionStartTime24:
                (currentSession as LocalSessionEntry).sessionStartTime24 ??
                null,
            sessionEndTime24:
                (currentSession as LocalSessionEntry).sessionEndTime24 ?? null,
        })
        : formatSessionDisplayName({
            sessionDay: (currentSession as DbSessionEntry).session_day,
            sessionSeason: (currentSession as DbSessionEntry).session_season,
            sessionYear: (currentSession as DbSessionEntry).session_year,
            startDate: (currentSession as DbSessionEntry).start_date,
            sessionStartTime24:
                (currentSession as DbSessionEntry).session_start_time24,
            sessionEndTime24:
                (currentSession as DbSessionEntry).session_end_time24,
        });

    const sourceLocations = isGuest
        ? getEffectiveSourceLocations({
            location: (currentSession as LocalSessionEntry).location ?? null,
            source_locations:
                (currentSession as LocalSessionEntry).sourceLocations ??
                [],
        })
        : getEffectiveSourceLocations(currentSession as DbSessionEntry);

    return {
        view: "ready" as const,
        title,
        isGuest,
        currentSession,
        teamName,
        sourceLocations,
    };

}
