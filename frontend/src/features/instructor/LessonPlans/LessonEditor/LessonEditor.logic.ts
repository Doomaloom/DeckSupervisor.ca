import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { fetchLessonPlan, type LessonRow, saveLessonPlan, } from "../../../../lib/serverApi";
import { curriculumLevels, defaultWorkoutText, findCurriculumLevel, isWorkoutSkill, } from "../lessonSkills";
export type RowDrag = {
    from: number;
    to: number;
    startY: number;
    offsetY: number;
    height: number;
    positions: { top: number; bottom: number }[];
    settling: boolean;
};

export function rowsForSave(rows: LessonRow[]) {
    return rows.map((row) => {
        if (!row.activities) return row;
        const activities = row.activities.filter((activity) => activity.text.trim());
        return {
            ...row,
            activities: activities.length ? activities : undefined,
            activity: activities.map((activity) => activity.text).join("\n\n"),
        };
    }).filter((row) =>
        row.skill.trim() || row.activity.trim() || row.workout ||
        row.location !== "Lane" || row.duration !== 5
    );
}

export function planContent(rows: LessonRow[], curriculumLevel: string | null) {
    return JSON.stringify({ rows, curriculum_level: curriculumLevel }, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value
    );
}

export function withDefaultWorkout(row: LessonRow): LessonRow {
    if (row.workout || row.activity.trim() || row.activities?.some((entry) =>
        entry.text.trim()
    )) return row;
    const activity = defaultWorkoutText(row.skill);
    return activity ? { ...row, activity, activities: undefined } : row;
}

export function rowActivities(row: LessonRow) {
    return row.activities || (row.activity && !row.workout
        ? [{ kind: "custom" as const, text: row.activity }]
        : []);
}

export function useLessonEditorLogic({ sessionId, classId, week, level, lessonDuration }: {
    sessionId: string;
    classId: string;
    week: string;
    level: string;
    lessonDuration: number;
}) {
    const [workoutRow, setWorkoutRow] = useState<number | null>(null);
    const [libraryRow, setLibraryRow] = useState<number | null>(null);
    const dragHelpId = useId();
    const tableRef = useRef<HTMLTableElement>(null);
    const [drag, setDrag] = useState<RowDrag | null>(null);
    const dragTimer = useRef<number | null>(null);
    const dropPending = useRef(false);
    const [reorderNotice, setReorderNotice] = useState("");
    const [rows, setRows] = useState<LessonRow[]>([]);
    const totalDuration = rows.reduce((total, row) =>
        total + (Number.isFinite(row.duration) ? Math.max(0, row.duration) : 0), 0);
    const [savedContent, setSavedContent] = useState(() => planContent([], null));
    const assignedLevel = findCurriculumLevel(level);
    const [curriculumLevel, setCurriculumLevel] = useState("");
    const selectedLevel = assignedLevel ||
        curriculumLevels.find((l) => l.id === curriculumLevel);
    const skills = selectedLevel?.skills || [];
    const [missing, setMissing] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const active = useRef(true);
    const persistableRows = useMemo(() => rowsForSave(rows), [rows]);
    const content = useMemo(() =>
        planContent(persistableRows, assignedLevel ? null : curriculumLevel || null),
        [persistableRows, assignedLevel, curriculumLevel]
    );
    const dirty = !loading && content !== savedContent;
    const blocker = useBlocker(dirty);
    useEffect(() => {
        if (blocker.state === "blocked") {
            if (window.confirm("Discard unsaved lesson plan changes?")) {
                blocker.proceed();
            } else blocker.reset();
        }
    }, [blocker]);
    useEffect(() => {
        active.current = true;
        let current = true;
        setLoading(true);
        setError("");
        fetchLessonPlan(sessionId, classId, week).then((r) => {
            if (current) {
                const loadedRows = (r.plan?.rows || []).map(withDefaultWorkout);
                const loadedLevel = r.plan?.curriculum_level || "";
                setRows(loadedRows);
                setCurriculumLevel(loadedLevel);
                setSavedContent(planContent(rowsForSave(loadedRows), assignedLevel ? null : loadedLevel || null));
                setMissing(!r.plan);
                setLoading(false);
            }
        }).catch((e) => {
            if (current) {
                setError(e.message);
                setLoading(false);
            }
        });
        return () => {
            current = false;
            active.current = false;
        };
    }, [sessionId, classId, week, retry, assignedLevel]);
    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("instructor-draft", { detail: dirty }),
        );
        const unload = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", unload);
        return () => {
            window.removeEventListener("beforeunload", unload);
            window.dispatchEvent(
                new CustomEvent("instructor-draft", { detail: false }),
            );
        };
    }, [dirty]);
    useEffect(() => {
        if (loading || saving || error || !dirty) return;
        const timer = window.setTimeout(async () => {
            setSaving(true);
            try {
                const snapshot = JSON.parse(content) as {
                    rows: LessonRow[];
                    curriculum_level: string | null;
                };
                await saveLessonPlan(
                    sessionId,
                    classId,
                    week,
                    snapshot.rows,
                    snapshot.curriculum_level,
                );
                if (active.current) {
                    setSavedContent(content);
                    setMissing(false);
                }
            } catch (e) {
                if (active.current) {
                    setError(e instanceof Error
                        ? e.message
                        : "Autosave failed.");
                }
            } finally {
                if (active.current) setSaving(false);
            }
        }, 100);
        return () => window.clearTimeout(timer);
    }, [sessionId, classId, week, loading, saving, error, dirty,
        content]);
    useEffect(() => () => {
        if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
    }, []);
    function edit(i: number, patch: Partial<LessonRow>) {
        setError("");
        setRows((current) =>
            current.map((r, index) => index === i ? { ...r, ...patch } : r)
        );
    }
    function editActivities(i: number, activities: NonNullable<LessonRow["activities"]>) {
        const activity = activities.filter((entry) => entry.text.trim())
            .map((entry) => entry.text).join("\n\n");
        if (activity.length > 10000) {
            setError("Activities in one row cannot exceed 10,000 characters.");
            return;
        }
        edit(i, { activities, activity });
    }
    function changeSkill(i: number, skill: string) {
        const activity = defaultWorkoutText(skill);
        if (activity) {
            edit(i, { skill, activity, workout: undefined, activities: undefined });
            return;
        }
        if (rows[i].workout && !isWorkoutSkill(skill)) {
            if (
                !window.confirm(
                    "Changing to this skill will convert the workout to text. Continue?",
                )
            ) return;
            edit(i, { skill, workout: undefined });
        } else edit(i, { skill });
    }
    function move(from: number, to: number) {
        if (from === to || to < 0 || to >= rows.length) return;
        setError("");
        setRows((current) => {
            const next = [...current];
            const [row] = next.splice(from, 1);
            next.splice(to, 0, row);
            return next;
        });
        setReorderNotice(`Row ${from + 1} moved to position ${to + 1}.`);
        tableRef.current?.querySelector<HTMLButtonElement>(
            `[data-row-index="${to}"] button`,
        )?.focus();
    }
    function dragTarget(current: RowDrag, y: number) {
        const center = (current.positions[current.from].top +
            current.positions[current.from].bottom) / 2 +
            y - current.startY;
        return current.positions.reduce(
            (to, position, index) =>
                to +
                (index !== current.from &&
                    center > (position.top + position.bottom) / 2
                    ? 1
                    : 0),
            0,
        );
    }
    function cancelDrag() {
        if (dragTimer.current !== null) window.clearTimeout(dragTimer.current);
        dragTimer.current = null;
        dropPending.current = false;
        setDrag(null);
    }
    const handleRowPointerUp = (i: number, e: PointerEvent<HTMLButtonElement>) => {
        if (
            !drag ||
            drag.from !== i ||
            drag.settling
        ) return;
        const to = dragTarget(
            drag,
            e.clientY,
        );
        const destination =
            to > drag.from
                ? drag.positions[to]
                    .bottom -
                drag.height
                : drag.positions[to]
                    .top;
        dropPending.current = true;
        setDrag({
            ...drag,
            to,
            offsetY: destination -
                drag.positions[
                    drag.from
                ].top,
            settling: true,
        });
        e.currentTarget
            .releasePointerCapture(
                e.pointerId,
            );
        dragTimer.current = window
            .setTimeout(
                () => {
                    if (
                        to !==
                        drag.from
                    ) {
                        move(
                            drag.from,
                            to,
                        );
                    }
                    setDrag(null);
                    dropPending
                        .current =
                        false;
                    dragTimer
                        .current =
                        null;
                },
                window.matchMedia?.(
                    "(prefers-reduced-motion: reduce)",
                ).matches
                    ? 0
                    : 200,
            );
    };
    const handleRowPointerMove = (i: number, e: PointerEvent<HTMLButtonElement>) => {
        if (
            !drag ||
            drag.from !== i ||
            drag.settling
        ) return;
        setDrag((current) =>
            current &&
                !current.settling
                ? {
                    ...current,
                    to: dragTarget(
                        current,
                        e.clientY,
                    ),
                    offsetY:
                        e.clientY -
                        current
                            .startY,
                }
                : current
        );
    };
    const handleRowPointerDown = (i: number, e: PointerEvent<HTMLButtonElement>) => {
        if (
            e.button !== 0 ||
            saving || drag
        ) return;
        const positions = Array
            .from(
                tableRef.current
                    ?.querySelectorAll<
                        HTMLTableRowElement
                    >("tr[data-row-index]") ||
                [],
                (row) => {
                    const rect = row
                        .getBoundingClientRect();
                    return {
                        top: rect
                            .top,
                        bottom:
                            rect.bottom,
                    };
                },
            );
        if (
            positions.length !==
            rows.length
        ) return;
        dropPending.current = false;
        e.currentTarget
            .setPointerCapture(
                e.pointerId,
            );
        setDrag({
            from: i,
            to: i,
            startY: e.clientY,
            offsetY: 0,
            height: positions[i]
                .bottom -
                positions[i].top,
            positions,
            settling: false,
        });
    };
    const handleRowKeyDown = (i: number, e: KeyboardEvent<HTMLButtonElement>) => {
        if (
            e.key === "ArrowUp" ||
            e.key === "ArrowDown"
        ) {
            e.preventDefault();
            move(
                i,
                i + (e.key ===
                    "ArrowUp"
                    ? -1
                    : 1),
            );
        }
    };
    if (loading) return { view: "loading" as const };
    if (error && !dirty && !rows.length) {
        return { view: "loadError" as const, error, setRetry };
    }
    return {
        view: "ready" as const,
        handleRowPointerUp,
        handleRowPointerMove,
        handleRowPointerDown,
        handleRowKeyDown,
        error,
        assignedLevel,
        curriculumLevel,
        setError,
        setCurriculumLevel,
        dragHelpId,
        reorderNotice,
        tableRef,
        totalDuration,
        lessonDuration,
        missing,
        rows,
        drag,
        move,
        saving,
        dropPending,
        setDrag,
        dragTarget,
        dragTimer,
        cancelDrag,
        selectedLevel,
        changeSkill,
        skills,
        setWorkoutRow,
        edit,
        editActivities,
        setLibraryRow,
        setRows,
        libraryRow,
        workoutRow,
    };

}

