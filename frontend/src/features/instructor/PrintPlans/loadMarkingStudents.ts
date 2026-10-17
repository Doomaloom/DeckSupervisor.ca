import { getLoadedRosterSession } from "../../../lib/loadedRosterSession";
import { loadUploadedPrintRosters } from "../../../lib/rosterPrintUpdates";
import { getStudentsForDay } from "../../../lib/storage";
import type { InstructorClass, InstructorSession } from "../../../lib/serverApi";

// Read only this account's local data, matched to the selected session and class.
export function loadMarkingStudents(session: InstructorSession, course: InstructorClass) {
    const code = course.code.trim();
    if (getLoadedRosterSession(session.session_day) === session.id) {
        const students = getStudentsForDay(session.session_day).filter((student) => student.code.trim() === code);
        if (students.length) return students.filter((student) => !student.waitlist).map(({ name }) => ({ name }));
    }
    const snapshots = loadUploadedPrintRosters(session.id);
    const roster = Object.values(snapshots).find((entry) => entry.roster.code.trim() === code)?.roster;
    return (roster?.students ?? []).filter((student) => !student.waitlist).map(({ name }) => ({ name }));
}
