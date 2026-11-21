import {
    deleteRosterStudentLevelEdit as deleteRosterStudentLevelEditRequest,
    fetchRosterEdits as fetchRosterEditsRequest,
    setRosterClassLevel as setRosterClassLevelRequest,
    upsertRosterLevelEdit as upsertRosterLevelEditRequest,
    upsertRosterStudentLevelEdit as upsertRosterStudentLevelEditRequest,
} from "./serverApi";
import { formatLevelName } from "../shared/levels/formatLevelName";
import type { Student } from "../types/app";
import { getStudentsForDay, setStudentsForDay } from "./storage";

export type RosterLevelEdit = {
    code: string;
    level: string;
};

export type StudentLevelEdit = {
    code: string;
    student_name_hash: string;
    level: string;
};

function normalizeName(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return "";
    }
    let result = "";
    let lastWasSpace = false;
    for (const char of trimmed) {
        const isLetter = /[a-z0-9]/.test(char);
        if (isLetter) {
            result += char;
            lastWasSpace = false;
            continue;
        }
        if (!lastWasSpace) {
            result += " ";
            lastWasSpace = true;
        }
    }
    return result.trim();
}

async function hashName(value: string): Promise<string> {
    const normalized = normalizeName(value);
    if (!normalized) {
        return "";
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fetchRosterLevelEdits(
    sessionId: string,
): Promise<RosterLevelEdit[]> {
    const data = await fetchRosterEditsRequest(sessionId);
    return data.rosterEdits ?? [];
}

export async function fetchRosterStudentEdits(
    sessionId: string,
): Promise<StudentLevelEdit[]> {
    const data = await fetchRosterEditsRequest(sessionId);
    return data.studentEdits ?? [];
}

export async function upsertRosterLevelEdit(
    sessionId: string,
    createdBy: string,
    code: string,
    level: string,
) {
    return upsertRosterLevelEditRequest({
        session_id: sessionId,
        created_by: createdBy,
        code,
        level,
    });
}

export async function upsertRosterStudentLevelEdit(
    sessionId: string,
    createdBy: string,
    code: string,
    studentName: string,
    level: string,
) {
    const hash = await hashName(studentName);
    if (!hash) {
        return null;
    }
    return upsertRosterStudentLevelEditRequest({
        session_id: sessionId,
        created_by: createdBy,
        code,
        student_name_hash: hash,
        level,
    });
}

export async function deleteRosterStudentLevelEdit(
    sessionId: string,
    code: string,
    studentName: string,
) {
    const hash = await hashName(studentName);
    if (!hash) {
        return null;
    }
    return deleteRosterStudentLevelEditRequest(sessionId, code, hash);
}

// Saves the class level for the whole class and removes every swimmer edit
// for it. An empty level removes the class edit too.
export async function setRosterClassLevel(
    sessionId: string,
    code: string,
    level: string,
) {
    return setRosterClassLevelRequest({
        session_id: sessionId,
        code,
        level,
    });
}

export async function hashStudentNames(
    names: string[],
): Promise<Map<string, string>> {
    const entries = await Promise.all(
        names.map(async (name) => ({ name, hash: await hashName(name) })),
    );
    const map = new Map<string, string>();
    entries.forEach((entry) => {
        if (entry.hash) {
            map.set(entry.name, entry.hash);
        }
    });
    return map;
}

export function applyPersistedLevelEdits(
    students: Student[],
    rosterEdits: RosterLevelEdit[],
    studentEdits: StudentLevelEdit[],
    nameHashMap: Map<string, string>,
): Student[] {
    if (students.length === 0) {
        return students;
    }

    // Older edits were saved as compact values ("Splash5"); read them as the
    // spaced name the level dropdown offers ("Splash 5").
    const levelByCode = new Map(
        rosterEdits.map((edit) => [edit.code, formatLevelName(edit.level)]),
    );
    const studentOverride = new Map(
        studentEdits.map(
            (edit) => [
                `${edit.code}:${edit.student_name_hash}`,
                formatLevelName(edit.level),
            ],
        ),
    );

    let changed = false;
    const next = students.map((student) => {
        const rosterLevel = levelByCode.get(student.code);
        const nameHash = nameHashMap.get(student.name);
        const overrideKey = nameHash ? `${student.code}:${nameHash}` : "";
        const studentLevel = overrideKey
            ? studentOverride.get(overrideKey)
            : undefined;
        // Caches saved before the file level was kept have no such level.
        // A swimmer with a saved edit is taken to have been uploaded on the
        // class's service name; any other swimmer on the level they show.
        const hasEdit = studentLevel !== undefined || rosterLevel !== undefined;
        const fileLevel = student.registered_level ??
            (hasEdit ? student.service_name : student.level);
        // With no edit left, a swimmer goes back to their own level in the
        // uploaded file (edits can now be removed).
        const resolvedLevel = studentLevel ?? rosterLevel ?? fileLevel;

        if (
            resolvedLevel === student.level &&
            rosterLevel === student.class_level &&
            fileLevel === student.registered_level
        ) {
            return student;
        }

        changed = true;
        const { class_level: _previous, ...rest } = student;
        return rosterLevel === undefined
            ? { ...rest, level: resolvedLevel, registered_level: fileLevel }
            : {
                ...rest,
                level: resolvedLevel,
                registered_level: fileLevel,
                class_level: rosterLevel,
            };
    });

    return changed ? next : students;
}

// Applies the session's saved level edits to the roster cached for a day, so
// pages that read only that cache (Print) match Rosters without visiting it.
export async function applySavedLevelEditsToStoredRoster(
    day: string,
    sessionId: string,
    isActive: () => boolean = () => true,
    options?: { silent?: boolean },
): Promise<void> {
    if (!day || !sessionId || getStudentsForDay(day, sessionId).length === 0) {
        return;
    }
    const data = await fetchRosterEditsRequest(sessionId);
    if (!isActive()) {
        return;
    }
    const students = getStudentsForDay(day, sessionId);
    const nameHashMap = await hashStudentNames(
        students.map((student) => student.name),
    );
    if (!isActive()) {
        return;
    }
    const next = applyPersistedLevelEdits(
        students,
        data.rosterEdits ?? [],
        data.studentEdits ?? [],
        nameHashMap,
    );
    if (next !== students) {
        setStudentsForDay(day, next, sessionId, options);
    }
}
