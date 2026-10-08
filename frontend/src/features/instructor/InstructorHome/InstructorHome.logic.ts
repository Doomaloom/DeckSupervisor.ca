import { useNavigate } from "react-router-dom";

import { useInstructorSession } from "../session/InstructorSessionContext";

import { compareSessionDays, SESSION_DAY_LABELS, } from "../../../shared/session/sessionDays";

import { getDayLabel } from "../../../shared/session/sessionLabels";

import { sessionLabel } from "../session/useInstructorClasses";

import type { InstructorSession } from "../../../lib/serverApi";

export function normalizedDay(day: string) {
    const trimmed = day.trim();
    return Object.entries(SESSION_DAY_LABELS).find(([key, label]) =>
        key.toLowerCase() === trimmed.toLowerCase() ||
        label.toLowerCase() === trimmed.toLowerCase()
    )?.[0] ?? trimmed;
}

export function groupInstructorSessions(sessions: InstructorSession[]) {
    const groups = new Map<string, InstructorSession[]>();
    for (const session of sessions) {
        const day = normalizedDay(session.session_day);
        groups.set(day, [...(groups.get(day) ?? []), session]);
    }
    return [...groups].sort(([a], [b]) => compareSessionDays(a, b)).map((
        [day, items],
    ) => ({
        day,
        label: getDayLabel(day) || "Other sessions",
        sessions: items.sort((a, b) =>
            (a.start_date || "9999").localeCompare(b.start_date || "9999") ||
            sessionLabel(a).localeCompare(sessionLabel(b)) ||
            (a.location || "").localeCompare(b.location || "") ||
            a.id.localeCompare(b.id)
        ),
    }));
}
export function useInstructorHomeLogic() {
    const state = useInstructorSession();
    const navigate = useNavigate();
    return { view: "ready" as const, state, navigate };

}
