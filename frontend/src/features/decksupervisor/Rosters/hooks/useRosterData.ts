import { useEffect, useMemo, useRef, useState } from "react";
import { applyPersistedLevelEdits, fetchRosterLevelEdits, fetchRosterStudentEdits, hashStudentNames, } from "../../../../lib/rosterEditsApi";
import { fetchSchematic } from "../../../../lib/serverApi";
import { getInstructorsForDay, getStudentsForDay, onStudentsUpdated, setInstructorsForDay, setStudentsForDay, } from "../../../../lib/storage";
import type { Student } from "../../../../types/app";
import { buildRosterGroups } from "../utils";

type RemoteSchematicData = {
    codes?: string[];
    instructors?: string[];
};

function buildInstructorMap(
    data: RemoteSchematicData | null,
): Map<string, string> {
    const byCode = new Map<string, string>();
    if (!data?.codes?.length) {
        return byCode;
    }
    const instructors = data.instructors ?? [];
    data.codes.forEach((encodedCodes, index) => {
        const instructor = (instructors[index] ?? "").trim();
        if (!instructor) {
            return;
        }
        encodedCodes
            .split(",")
            .map((code) => code.trim())
            .filter(Boolean)
            .forEach((code) => byCode.set(code, instructor));
    });
    return byCode;
}

function applyInstructorAssignments(
    students: Student[],
    byCode: Map<string, string>,
): Student[] {
    if (students.length === 0 || byCode.size === 0) {
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

export function useRosterData(
    selectedDay: string,
    sessionId?: string,
    isGuest?: boolean,
) {
    const [students, setStudents] = useState<Student[]>([]);
    const [remoteSchematic, setRemoteSchematic] = useState<
        RemoteSchematicData | null
    >(null);
    const appliedEditsKey = useRef("");

    useEffect(() => {
        setStudents(getStudentsForDay(selectedDay, sessionId));
    }, [selectedDay, sessionId]);

    useEffect(() => {
        return onStudentsUpdated((day) => {
            if (day === selectedDay) {
                setStudents(getStudentsForDay(selectedDay, sessionId));
            }
        });
    }, [selectedDay, sessionId]);

    useEffect(() => {
        if (!sessionId || isGuest) {
            setRemoteSchematic(null);
            return;
        }
        let active = true;
        const loadSchematic = async () => {
            const response = await fetchSchematic(sessionId);
            if (!active) {
                return;
            }
            const value = (response.schematic?.data ?? null) as
                | RemoteSchematicData
                | null;
            setRemoteSchematic(value);
            if (selectedDay) {
                setInstructorsForDay(selectedDay, {
                    names: value?.instructors ?? [],
                    codes: value?.codes ?? [],
                });
            }
        };
        void loadSchematic();
        return () => {
            active = false;
        };
    }, [isGuest, selectedDay, sessionId]);

    useEffect(() => {
        if (!sessionId || isGuest || students.length === 0) {
            return;
        }
        const byCode = buildInstructorMap(remoteSchematic);
        const next = applyInstructorAssignments(students, byCode);
        if (next === students) {
            return;
        }
        setStudents(next);
        // Stored from the cache, so a level that is on screen but not saved
        // yet never reaches it.
        setStudentsForDay(
            selectedDay,
            applyInstructorAssignments(
                getStudentsForDay(selectedDay, sessionId),
                byCode,
            ),
            sessionId,
            { silent: true },
        );
    }, [isGuest, remoteSchematic, selectedDay, sessionId, students]);

    // Saved levels are applied once per loaded roster, not after each level
    // change on this page: a change that is still saving, or failed to save,
    // must stay on screen as it is.
    const studentsRef = useRef(students);
    studentsRef.current = students;
    const rosterKey = useMemo(
        () => students.map((student) => student.id).join("|"),
        [students],
    );
    useEffect(() => {
        if (!sessionId || isGuest || rosterKey === "") {
            return;
        }
        let active = true;
        // Levels as they were when the fetch began. A swimmer or class changed
        // since then keeps the change instead of taking the fetched edits.
        const levelKey = (student: Student) =>
            `${student.level}\u0000${student.class_level ?? ""}`;
        const atStart = new Map(
            studentsRef.current.map((student) => [
                student.id,
                levelKey(student),
            ]),
        );
        const keepNewerChanges = (before: Student[], after: Student[]) =>
            after.map((student, index) => {
                const original = before[index];
                const started = atStart.get(original.id);
                return started !== undefined && started !== levelKey(original)
                    ? original
                    : student;
            });
        const applyEdits = async () => {
            const [rosterEdits, studentEdits] = await Promise.all([
                fetchRosterLevelEdits(sessionId),
                fetchRosterStudentEdits(sessionId),
            ]);
            if (!active) {
                return;
            }
            const editsKey = JSON.stringify({
                sessionId,
                rosterKey,
                rosterEdits,
                studentEdits,
            });
            if (editsKey === appliedEditsKey.current) {
                return;
            }
            appliedEditsKey.current = editsKey;

            const nameHashMap = await hashStudentNames(
                studentsRef.current.map((student) => student.name),
            );
            if (!active) {
                return;
            }
            setStudents((current) =>
                keepNewerChanges(
                    current,
                    applyPersistedLevelEdits(
                        current,
                        rosterEdits,
                        studentEdits,
                        nameHashMap,
                    ),
                )
            );
            // The cache holds only what the server has confirmed.
            const cached = getStudentsForDay(selectedDay, sessionId);
            if (cached.length === 0) {
                return;
            }
            setStudentsForDay(
                selectedDay,
                keepNewerChanges(
                    cached,
                    applyPersistedLevelEdits(
                        cached,
                        rosterEdits,
                        studentEdits,
                        nameHashMap,
                    ),
                ),
                sessionId,
                { silent: true },
            );
        };
        void applyEdits();
        return () => {
            active = false;
        };
    }, [isGuest, rosterKey, selectedDay, sessionId]);

    const rosters = useMemo(() => buildRosterGroups(students), [students]);
    const instructorOptions = useMemo(() => {
        // Prefer this session's schematic once it has loaded; the weekday
        // list may be empty (just after an upload) or from another session.
        const names = remoteSchematic?.instructors?.length
            ? remoteSchematic.instructors
            : getInstructorsForDay(selectedDay)?.names ?? [];
        return Array.from(
            new Set(names.map((name) => name.trim()).filter(Boolean)),
        );
    }, [remoteSchematic, selectedDay]);
    return {
        students,
        setStudents,
        rosters,
        instructorOptions,
    };
}
