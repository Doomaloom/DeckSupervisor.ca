import type { ClassRoster, CsvSessionCandidate } from "../types/app";
import { getStoredItem, setStoredItem } from "./browserStorage";
import { getScopedKey } from "./storageScope";
import { syncRosterClassHashes } from "./serverApi";

export type RosterClassHash = {
    code: string;
    roster_hash: string;
    class_details: Omit<ClassRoster, "students">;
};

export type RosterPrintUpdate = {
    code: string;
    roster_hash: string;
    revision: string;
    changed_at: string;
};

export type UploadedPrintRoster = {
    hash: string;
    roster: ClassRoster;
};

const cacheKey = (sessionId: string) =>
    getScopedKey(`print-update-rosters:${sessionId}`);

export function loadUploadedPrintRosters(sessionId: string): Record<string, UploadedPrintRoster> {
    try {
        return JSON.parse(getStoredItem(cacheKey(sessionId)) ?? "{}");
    } catch {
        return {};
    }
}

// Only hashes and class metadata leave the database RPC. Student rows stay in
// the browser's existing user-scoped session storage, alongside other rosters.
export async function trackUploadedRosters(sessionId: string, classes: ClassRoster[]) {
    const response = await syncRosterClassHashes(sessionId, classes);
    const byCode = new Map(classes.map((roster) => [roster.code.trim(), roster]));
    const snapshots: Record<string, UploadedPrintRoster> = {};
    for (const row of response.classes) {
        snapshots[row.code] = {
            hash: row.roster_hash,
            roster: {
                ...row.class_details,
                code: row.code,
                students: byCode.get(row.code)?.students ?? [],
            },
        };
    }
    setStoredItem(cacheKey(sessionId), JSON.stringify(snapshots));
}

// Team CSVs may contain multiple saved sessions. Never compare their combined
// students against one session, and do not create sessions implicitly here.
export async function trackMatchedSessionRosters(
    candidates: CsvSessionCandidate[],
    rostersByCandidate: Record<string, ClassRoster[]>,
) {
    const classesBySession = new Map<string, ClassRoster[]>();
    for (const candidate of candidates) {
        const sessionId = candidate.matchedSession?.session.id;
        if (sessionId) {
            const classes = rostersByCandidate[candidate.sessionKey];
            if (!classes) throw new Error("No roster data was returned for a matched session. Print tracking was not updated.");
            classesBySession.set(sessionId, [...(classesBySession.get(sessionId) ?? []), ...classes]);
        }
    }
    for (const [sessionId, classes] of classesBySession) {
        await trackUploadedRosters(sessionId, classes);
    }
}
