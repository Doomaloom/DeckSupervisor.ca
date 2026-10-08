import { rosterToStudents } from "../../../lib/api";
import { getLoadedRosterSession } from "../../../lib/loadedRosterSession";
import { getStudentsForDay } from "../../../lib/storage";
import type { RosterPrintUpdate, UploadedPrintRoster } from "../../../lib/rosterPrintUpdates";
import { buildAttendancePrintItems, buildRosterGroups } from "../../rosters/utils";

export function buildUpdatePrintItems(
    sessionId: string,
    updates: RosterPrintUpdate[],
    snapshots: Record<string, UploadedPrintRoster>,
) {
    return updates.flatMap((update) => {
        const snapshot = snapshots[update.code];
        if (!snapshot || snapshot.hash !== update.roster_hash) {
            throw new Error(`Upload the latest roster for class ${update.code} on this device before printing.`);
        }
        const roster = snapshot.roster;
        const students = rosterToStudents([roster]);
        const group = buildRosterGroups(students)[0] ?? {
            code: roster.code,
            serviceName: roster.serviceName,
            level: roster.serviceName,
            time: roster.time,
            instructor: roster.instructor,
            location: roster.location,
            schedule: roster.schedule,
            students: [],
        };
        // Assignment changes are not student changes. Use the current local
        // assignment only when those day rows came from this same session.
        if (getLoadedRosterSession(roster.day) === sessionId) {
            const current = getStudentsForDay(roster.day).find((s) => s.code === roster.code && s.instructor);
            if (current) group.instructor = current.instructor;
        }
        return buildAttendancePrintItems(group);
    });
}
