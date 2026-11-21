import { useCallback, useEffect, useRef, useState } from "react";
import {
    applySavedLevelEditsToStoredRoster,
    deleteRosterStudentLevelEdit,
    setRosterClassLevel,
    upsertRosterStudentLevelEdit,
} from "../../../../lib/rosterEditsApi";
import { getStudentsForDay, setStudentsForDay } from "../../../../lib/storage";
import { formatLevelName } from "../../../../shared/levels/formatLevelName";
import type { Student } from "../../../../types/app";

type UseRosterEditsParams = {
    selectedDay: string;
    students: Student[];
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    sessionId?: string;
    currentUserId?: string;
    canEdit?: boolean;
    onInstructorPdfDirty?: (instructors: string[]) => void;
};

// A save that did not go through. `target` is "class" or a swimmer's id.
export type SaveFailure = {
    target: string;
    message: string;
};

export type CardSaveState = {
    status: "" | "saving" | "saved";
    failures: SaveFailure[];
};

export const emptyCardSaveState: CardSaveState = {
    status: "",
    failures: [],
};

const SAVED_SHOWN_MS = 1500;

type EditPlan = {
    code: string;
    target: string;
    failureMessage: string;
    // Pure: the same change is applied to the page and, once the server
    // confirms it, to the browser's roster cache.
    apply: (students: Student[]) => Student[];
    // Null when there is nothing to send to the server.
    persist: (() => Promise<unknown> | null) | null;
    instructors: string[];
};

const keyOf = (code: string, target: string) => `${code}\u0000${target}`;

function cleanName(name: string) {
    return name.replace(/"/g, "");
}

export function useRosterEdits({
    selectedDay,
    students,
    setStudents,
    sessionId,
    currentUserId,
    canEdit,
    onInstructorPdfDirty,
}: UseRosterEditsParams) {
    const [saveStates, setSaveStates] = useState<Record<string, CardSaveState>>(
        {},
    );
    const studentsRef = useRef(students);
    studentsRef.current = students;
    const inFlight = useRef(new Map<string, number>());
    const savedTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const retries = useRef(new Map<string, () => void>());
    // Saves for one class run one after another, in the order they were made.
    const queues = useRef(new Map<string, Promise<void>>());
    // Swimmer saves made while a class save was waiting for a retry.
    const afterFailedClass = useRef(new Map<string, Map<string, EditPlan>>());
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        const timers = savedTimers.current;
        return () => {
            mounted.current = false;
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const notifyDirtyInstructors = (instructors: string[]) => {
        const names = Array.from(
            new Set(instructors.map((name) => name.trim()).filter(Boolean)),
        );
        if (names.length === 0) {
            return;
        }
        onInstructorPdfDirty?.(names);
    };

    const updateCard = (
        code: string,
        change: (current: CardSaveState) => CardSaveState,
    ) => {
        if (!mounted.current) {
            return;
        }
        setSaveStates((all) => ({
            ...all,
            [code]: change(all[code] ?? emptyCardSaveState),
        }));
    };

    const finish = (code: string, target: string, failure?: SaveFailure) => {
        const left = Math.max((inFlight.current.get(code) ?? 1) - 1, 0);
        inFlight.current.set(code, left);
        const clearOld = (failures: SaveFailure[]) =>
            failures.filter((item) =>
                item.target !== target &&
                // A whole class save settles every swimmer's earlier failure.
                !(target === "class" && !failure)
            );
        updateCard(code, (current) => {
            const failures = failure
                ? [...clearOld(current.failures), failure]
                : clearOld(current.failures);
            if (failure) {
                return {
                    status: left > 0 ? "saving" : "",
                    failures,
                };
            }
            return { status: left > 0 ? "saving" : "saved", failures };
        });
        if (!failure && left === 0) {
            clearTimeout(savedTimers.current.get(code));
            savedTimers.current.set(
                code,
                setTimeout(() => {
                    updateCard(code, (current) =>
                        current.status === "saved"
                            ? { ...current, status: "" }
                            : current
                    );
                }, SAVED_SHOWN_MS),
            );
        }
    };

    const writeCache = (plan: EditPlan) => {
        // Written from the cache itself, so a change that did not save yet is
        // never stored.
        setStudentsForDay(
            selectedDay,
            plan.apply(getStudentsForDay(selectedDay, sessionId)),
            sessionId,
            { silent: true },
        );
    };

    const save = (plan: EditPlan) => {
        clearTimeout(savedTimers.current.get(plan.code));
        inFlight.current.set(
            plan.code,
            (inFlight.current.get(plan.code) ?? 0) + 1,
        );
        updateCard(plan.code, (current) => ({ ...current, status: "saving" }));
        const queued = (queues.current.get(plan.code) ?? Promise.resolve())
            .then(() => saveNow(plan));
        queues.current.set(plan.code, queued);
        return queued;
    };

    // After a failed whole class save the server may hold only part of it, so
    // the cache is rebuilt from what the server really has. The screen keeps
    // the change.
    const reloadCacheFromServer = async () => {
        if (!sessionId) {
            return;
        }
        try {
            await applySavedLevelEditsToStoredRoster(
                selectedDay,
                sessionId,
                () => mounted.current,
                { silent: true },
            );
        } catch (error) {
            console.error("Failed to reload saved levels", error);
        }
    };

    const saveNow = async (plan: EditPlan) => {
        const key = keyOf(plan.code, plan.target);
        try {
            // The server call is awaited inside the try, so a failure always
            // reaches the catch and the cache is not written.
            await plan.persist?.();
        } catch (error) {
            console.error("Failed to save roster level edit", error);
            retries.current.set(key, () => {
                void save(plan);
                // Swimmer changes made since replay on top of the class save.
                afterFailedClass.current.get(plan.code)?.forEach((later) =>
                    void save(later)
                );
            });
            finish(plan.code, plan.target, {
                target: plan.target,
                message: plan.failureMessage,
            });
            if (plan.target === "class") {
                await reloadCacheFromServer();
            }
            return;
        }
        retries.current.delete(key);
        if (plan.target === "class") {
            afterFailedClass.current.delete(plan.code);
        }
        writeCache(plan);
        finish(plan.code, plan.target);
    };

    const run = (plan: EditPlan) => {
        setStudents((current) => plan.apply(current));
        notifyDirtyInstructors(plan.instructors);
        const signedIn = Boolean(sessionId && currentUserId);
        if (!signedIn) {
            // Guests have no server save; their edits live in the cache.
            writeCache(plan);
            return;
        }
        const key = keyOf(plan.code, plan.target);
        if (plan.target === "class") {
            // A whole class save replaces what was waiting for a retry.
            retries.current.delete(key);
            afterFailedClass.current.delete(plan.code);
            retries.current.forEach((_retry, other) => {
                if (other.startsWith(`${plan.code}\u0000`)) {
                    retries.current.delete(other);
                }
            });
        } else {
            // A failed class save goes first, so it cannot later undo this.
            const classKey = keyOf(plan.code, "class");
            const pending = retries.current.get(classKey);
            if (pending) {
                pending();
                const later = afterFailedClass.current.get(plan.code) ??
                    new Map<string, EditPlan>();
                later.set(plan.target, plan);
                afterFailedClass.current.set(plan.code, later);
            }
            retries.current.delete(key);
        }
        void save(plan);
    };

    const classContext = (code: string) => {
        const classStudents = studentsRef.current.filter((student) =>
            student.code === code
        );
        const first = classStudents[0];
        const registered = formatLevelName(first?.service_name ?? "");
        const classEdit = classStudents.find((student) => student.class_level)
            ?.class_level;
        const mixedInFile = classStudents.some((student) =>
            formatLevelName(student.registered_level || student.service_name) !==
                registered
        );
        return {
            classStudents,
            registered,
            hasClassEdit: Boolean(classEdit),
            classLevel: classEdit ? formatLevelName(classEdit) : registered,
            mixedInFile,
        };
    };

    // Every whole class action goes through here: it sets the class level for
    // every swimmer, waitlisted ones included, and drops all swimmer edits.
    const applyClassLevel = (
        code: string,
        level: string,
        failureMessage: string,
    ) => {
        if (canEdit === false) {
            return;
        }
        const { classStudents, registered, mixedInFile } = classContext(code);
        // The registered level needs no saved class edit, unless swimmers
        // arrived on other levels and must follow the class.
        const stored = formatLevelName(level) === registered && !mixedInFile
            ? ""
            : level;
        run({
            code,
            target: "class",
            failureMessage,
            apply: (list) =>
                list.map((student) => {
                    if (student.code !== code) {
                        return student;
                    }
                    const { class_level: _previous, ...rest } = student;
                    return stored
                        ? { ...rest, level, class_level: stored }
                        : { ...rest, level };
                }),
            persist: () => setRosterClassLevel(sessionId!, code, stored),
            instructors: classStudents.map((student) => student.instructor),
        });
    };

    const handleClassLevelChange = (code: string, level: string) =>
        applyClassLevel(
            code,
            level,
            `Couldn't save the class level (${level}). Check your connection, then press Retry.`,
        );

    const handleSetAllToLevel = (code: string, level: string) =>
        applyClassLevel(
            code,
            level,
            `Couldn't set all swimmers to ${level}. Check your connection, then press Retry.`,
        );

    const handleStudentLevelChange = (studentId: string, level: string) => {
        if (canEdit === false) {
            return;
        }
        const student = studentsRef.current.find((item) =>
            item.id === studentId
        );
        if (!student) {
            return;
        }
        const code = student.code;
        const { classLevel, hasClassEdit } = classContext(code);
        const onClassLevel = formatLevelName(level) === classLevel;
        // Without their edit a swimmer is on the class edit, or else on their
        // own level from the file.
        const fileLevel = formatLevelName(
            student.registered_level || student.service_name,
        );
        const landsOnClass = hasClassEdit || fileLevel === classLevel;
        const removeEdit = onClassLevel && landsOnClass;
        run({
            code,
            target: studentId,
            failureMessage:
                `Couldn't save ${cleanName(student.name)}'s level (${level}). Check your connection, then press Retry.`,
            apply: (list) =>
                list.map((item) =>
                    item.id === studentId ? { ...item, level } : item
                ),
            persist: () =>
                removeEdit
                    ? deleteRosterStudentLevelEdit(
                        sessionId!,
                        code,
                        student.name,
                    )
                    : upsertRosterStudentLevelEdit(
                        sessionId!,
                        currentUserId!,
                        code,
                        student.name,
                        level,
                    ),
            instructors: [student.instructor],
        });
    };

    const retrySave = useCallback((code: string, target: string) => {
        retries.current.get(keyOf(code, target))?.();
    }, []);

    return {
        handleClassLevelChange,
        handleSetAllToLevel,
        handleStudentLevelChange,
        saveStates,
        retrySave,
    };
}
