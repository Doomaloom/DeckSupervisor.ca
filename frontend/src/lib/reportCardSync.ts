import type { Student } from "../types/app";
import { formatSessionTermLabel } from "../shared/session/sessionLabels";
import { syncReportCards } from "./serverApi";

const UNASSIGNED_LABEL = "Unassigned";

type SyncReportCardsForDayParams = {
    day: string;
    students: Student[];
    sessionLabel: string;
    teamId: string | null;
};

export type SyncReportCardsForDayResult =
    | { status: "synced" }
    | { status: "blocked_unassigned" }
    | { status: "empty" };

function normalizeInstructor(value: string | null | undefined) {
    return (value ?? "").trim();
}

export const getSessionTermLabel = formatSessionTermLabel;

export type SavedSchematicAssignments = {
    codes?: string[];
    instructors?: string[];
} | null | undefined;

// Waitlisted swimmers are not in a class, so they get no report card (Schematic,
// Device Export and marking sheets leave them out too).
export function reportCardStudents(students: Student[]) {
    return students.filter((student) => !student.waitlist);
}

export function hasSavedSchematicAssignments(data: SavedSchematicAssignments) {
    return Boolean(data?.codes?.some((codes) => codes.trim()));
}

// Roster uploads carry no instructors; the saved Schematic is the source of truth
// for which instructor teaches each class code.
export function applySchematicAssignments(
    students: Student[],
    data: SavedSchematicAssignments,
): Student[] {
    const byCode = new Map<string, string>();
    (data?.codes ?? []).forEach((encodedCodes, index) => {
        const instructor = (data?.instructors?.[index] ?? "").trim();
        if (!instructor) {
            return;
        }
        encodedCodes.split(",").map((code) => code.trim()).filter(Boolean)
            .forEach((code) => byCode.set(code, instructor));
    });
    if (byCode.size === 0) {
        return students;
    }
    let changed = false;
    const next = students.map((student) => {
        const assigned = byCode.get(student.code);
        if (!assigned || assigned === student.instructor) {
            return student;
        }
        changed = true;
        return { ...student, instructor: assigned };
    });
    return changed ? next : students;
}

export async function syncReportCardsForDay({
    day,
    students,
    sessionLabel,
    teamId,
}: SyncReportCardsForDayParams): Promise<SyncReportCardsForDayResult> {
    let hasUnassignedInstructors = false;
    const booked = reportCardStudents(students);

    booked.forEach((student) => {
        const instructor = normalizeInstructor(student.instructor);
        if (!instructor) {
            hasUnassignedInstructors = true;
            return;
        }
    });

    if (hasUnassignedInstructors) {
        return { status: "blocked_unassigned" };
    }
    return syncReportCards({ day, students: booked, sessionLabel, teamId });
}

export function isUnassignedInstructor(name: string) {
    return normalizeInstructor(name) === UNASSIGNED_LABEL;
}
