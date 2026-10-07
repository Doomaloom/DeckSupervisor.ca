import {
    ActionButton,
    Notice,
    Select,
    Textarea,
} from "../../general-components";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import {
    fetchLessonPlan,
    type LessonRow,
    saveLessonPlan,
} from "../../lib/serverApi";
import ActivityLibraryModal from "../activity-library/ActivityLibraryModal";
import { activityText } from "../activity-library/activityLibrary";
import WorkoutBuilderModal from "../workout-builder/WorkoutBuilderModal";
import { workoutText } from "../workout-builder/workout";
import PlanSelection from "./PlanSelection";
import DurationPicker from "./DurationPicker";
import {
    curriculumLevels,
    defaultWorkoutText,
    findCurriculumLevel,
    isWorkoutSkill,
} from "./lessonSkills";

type RowDrag = {
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

function planContent(rows: LessonRow[], curriculumLevel: string | null) {
    return JSON.stringify({ rows, curriculum_level: curriculumLevel }, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value
    );
}

function withDefaultWorkout(row: LessonRow): LessonRow {
    if (row.workout || row.activity.trim() || row.activities?.some((entry) =>
        entry.text.trim()
    )) return row;
    const activity = defaultWorkoutText(row.skill);
    return activity ? { ...row, activity, activities: undefined } : row;
}

function rowActivities(row: LessonRow) {
    return row.activities || (row.activity && !row.workout
        ? [{ kind: "custom" as const, text: row.activity }]
        : []);
}

export function LessonEditor(
    { sessionId, classId, week, level }: {
        sessionId: string;
        classId: string;
        week: string;
        level: string;
    },
) {
    const [workoutRow, setWorkoutRow] = useState<number | null>(null);
    const [libraryRow, setLibraryRow] = useState<number | null>(null);
    const dragHelpId = useId();
    const tableRef = useRef<HTMLTableElement>(null);
    const [drag, setDrag] = useState<RowDrag | null>(null);
    const dragTimer = useRef<number | null>(null);
    const dropPending = useRef(false);
    const [reorderNotice, setReorderNotice] = useState("");
    const [rows, setRows] = useState<LessonRow[]>([]);
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
    const [notice, setNotice] = useState("");
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
            setNotice("");
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
                    setNotice("All changes saved.");
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
        setNotice("");
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
        setNotice("");
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
    if (loading) return <p role="status">Loading saved lesson plan…</p>;
    if (error && !dirty && !rows.length) {
        return (
            <Notice tone="danger" role="alert">
                {error}{" "}
                <ActionButton onClick={() => setRetry((v) => v + 1)}>
                    Retry
                </ActionButton>
            </Notice>
        );
    }
    return (
        <div className="flex flex-col gap-4">
            {error && (
                <Notice tone="danger" role="alert">
                    {error} Your draft is retained.
                </Notice>
            )}
            {saving && <p role="status" className="text-sm">Saving…</p>}
            {notice && <p role="status" className="text-sm">{notice}</p>}
            <fieldset className="min-w-0 space-y-4">
                {!assignedLevel && (
                    <label className="mb-4 flex flex-col gap-2 text-sm font-semibold">
                        Curriculum level{" "}
                        <Select
                            aria-label="Curriculum level"
                            required
                            className="max-w-full"
                            value={curriculumLevel}
                            onChange={(e) => {
                                setNotice("");
                                setError("");
                                setCurriculumLevel(e.target.value);
                            }}
                        >
                            <option value="">Select curriculum level</option>
                            {curriculumLevels.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                )}
                <p id={dragHelpId} className="sr-only">
                    Drag to reorder, or use the up and down arrow keys.
                </p>
                <p role="status" className="sr-only">{reorderNotice}</p>
                <p className="text-sm md:hidden">
                    Scroll the activity table sideways to edit pool location,
                    duration, and row order.
                </p>
                <div
                    className="overflow-x-auto rounded-2xl border border-secondary/20 bg-accent text-secondary shadow-sm"
                    tabIndex={0}
                    role="region"
                    aria-label="Scrollable activity table"
                >
                    <table
                        ref={tableRef}
                        className="w-full min-w-[960px] border-collapse text-center"
                    >
                        <thead className="bg-primary text-accent">
                            <tr>
                                <th className="w-12">
                                    <span className="sr-only">Reorder</span>
                                </th>
                                {[
                                    "Skill",
                                    "Activity / drill",
                                    "Pool location",
                                    "Duration",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="border-b border-secondary/20 p-3 align-middle"
                                    >
                                        {h}
                                    </th>
                                ))}
                                <th className="w-14">
                                    <span className="sr-only">Delete</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {missing && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="border-b border-secondary/20 bg-bg px-4 py-8 text-center text-sm text-secondary/70"
                                    >
                                        No lesson plan saved for this week.
                                        Opening this editor creates no record.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row, i) => {
                                const dragged = drag?.from === i;
                                const selectedLocation = row.location.startsWith("Lane")
                                    ? "Lane"
                                    : row.location;
                                const shift = drag && !dragged &&
                                    ((drag.from < i && i <= drag.to)
                                        ? -drag.height
                                        : (drag.to <= i && i < drag.from)
                                        ? drag.height
                                        : 0);
                                return (
                                    <tr
                                        key={i}
                                        data-row-index={i}
                                        style={{
                                            transform: dragged
                                                ? `translate3d(0, ${drag.offsetY}px, 0)`
                                                : shift
                                                ? `translate3d(0, ${shift}px, 0)`
                                                : undefined,
                                        }}
                                        className={dragged
                                            ? `relative z-10 bg-accent shadow-xl ring-2 ring-primary ${
                                                drag.settling
                                                    ? "transition-transform duration-200 ease-out motion-reduce:transition-none"
                                                    : ""
                                            }`
                                            : drag
                                            ? "transition-transform duration-200 ease-out motion-reduce:transition-none"
                                            : undefined}
                                    >
                                        <td className="border-b border-secondary/20 p-3 align-middle">
                                            <button
                                                type="button"
                                                aria-label={`Reorder row ${
                                                    i + 1
                                                }`}
                                                aria-describedby={dragHelpId}
                                                disabled={rows.length < 2}
                                                className="mx-auto flex h-11 w-11 touch-none select-none items-center justify-center rounded-lg text-secondary hover:bg-secondary/10 focus-visible:outline focus-visible:outline-2 disabled:opacity-40 cursor-grab active:cursor-grabbing"
                                                onKeyDown={(e) => {
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
                                                }}
                                                onPointerDown={(e) => {
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
                                                }}
                                                onPointerMove={(e) => {
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
                                                }}
                                                onPointerUp={(e) => {
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
                                                }}
                                                onPointerCancel={cancelDrag}
                                                onLostPointerCapture={() => {
                                                    if (
                                                        !dropPending.current
                                                    ) cancelDrag();
                                                }}
                                            >
                                                <svg
                                                    aria-hidden="true"
                                                    width="20"
                                                    height="24"
                                                    viewBox="0 0 20 24"
                                                    fill="currentColor"
                                                >
                                                    {[6, 12, 18].flatMap((y) =>
                                                        [7, 13].map((x) => (
                                                            <circle
                                                                key={`${x}-${y}`}
                                                                cx={x}
                                                                cy={y}
                                                                r="1.5"
                                                            />
                                                        ))
                                                    )}
                                                </svg>
                                            </button>
                                        </td>
                                        <td className="border-b border-secondary/20 p-3 align-middle">
                                            <Select
                                                title={row.skill || undefined}
                                                aria-label={`Skill ${i + 1}`}
                                                className="mx-auto w-full min-w-40 max-w-xs text-center"
                                                disabled={!selectedLevel}
                                                value={row.skill}
                                                onChange={(e) =>
                                                    changeSkill(
                                                        i,
                                                        e.target.value,
                                                    )}
                                            >
                                                <option value="">
                                                    {selectedLevel
                                                        ? "Select skill"
                                                        : "Choose curriculum level first"}
                                                </option>
                                                {row.skill &&
                                                    !skills.some((skill) =>
                                                        skill.name === row.skill
                                                    ) && (
                                                    <option value={row.skill}>
                                                        {row.skill}{" "}
                                                        (saved skill)
                                                    </option>
                                                )}
                                                {skills.map((skill) => (
                                                    <option
                                                        key={skill.id}
                                                        value={skill.name}
                                                    >
                                                        {skill.compactName}
                                                    </option>
                                                ))}
                                            </Select>
                                        </td>
                                        <td className="border-b border-secondary/20 p-3 align-middle">
                                            {row.workout || isWorkoutSkill(row.skill)
                                                ? (
                                                    <>
                                                        <p
                                                            className="whitespace-pre-wrap break-words text-sm"
                                                            aria-label={`Workout summary ${
                                                                i + 1
                                                            }`}
                                                        >
                                                            {row.activity || "Choose a custom workout for this skill."}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                                                            {isWorkoutSkill(
                                                                row.skill,
                                                            ) && (
                                                                <ActionButton
                                                                    size="sm"
                                                                    variant="outline"
                                                                    aria-label={`Use custom workout for row ${
                                                                        i + 1
                                                                    }`}
                                                                    onClick={() =>
                                                                        setWorkoutRow(
                                                                            i,
                                                                        )}
                                                                >
                                                                    Use custom workout
                                                                </ActionButton>
                                                            )}
                                                            {!isWorkoutSkill(row.skill) && (
                                                                <ActionButton
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    aria-label={`Convert workout in row ${
                                                                        i + 1
                                                                    } to text`}
                                                                    onClick={() => {
                                                                        if (
                                                                            window
                                                                                .confirm(
                                                                                    "Convert this workout to text? Its sets will no longer be editable in the workout builder.",
                                                                                )
                                                                        ) {
                                                                            edit(
                                                                                i,
                                                                                {
                                                                                    workout:
                                                                                        undefined,
                                                                                },
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    Convert to text
                                                                </ActionButton>
                                                            )}
                                                        </div>
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        <div className="space-y-3">
                                                            {rowActivities(row).map((entry, activityIndex) => (
                                                                <div key={activityIndex} className="rounded-xl border border-secondary/20 p-2">
                                                                    <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
                                                                        <span>
                                                                            {entry.kind === "library" ? "Library activity" : "Custom activity"} {activityIndex + 1}
                                                                        </span>
                                                                        <ActionButton
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            aria-label={`Remove activity ${activityIndex + 1} from row ${i + 1}`}
                                                                            onClick={() => editActivities(
                                                                                i,
                                                                                rowActivities(row).filter((_, index) => index !== activityIndex),
                                                                            )}
                                                                        >
                                                                            Remove
                                                                        </ActionButton>
                                                                    </div>
                                                                    {entry.kind === "custom"
                                                                        ? (
                                                                            <Textarea
                                                                                minRowsClassName="min-h-24"
                                                                                aria-label={activityIndex === 0
                                                                                    ? `Activity / drill ${i + 1}`
                                                                                    : `Activity / drill ${i + 1}, activity ${activityIndex + 1}`}
                                                                                className="w-full min-w-48 text-center"
                                                                                maxLength={10000}
                                                                                value={entry.text}
                                                                                onChange={(e) => editActivities(
                                                                                    i,
                                                                                    rowActivities(row).map((activity, index) =>
                                                                                        index === activityIndex
                                                                                            ? { ...activity, text: e.target.value }
                                                                                            : activity
                                                                                    ),
                                                                                )}
                                                                            />
                                                                        )
                                                                        : (
                                                                            <p className="whitespace-pre-wrap break-words text-sm">
                                                                                {entry.text}
                                                                            </p>
                                                                        )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                                                            <ActionButton
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={rowActivities(row).length >= 100}
                                                                aria-label={`Browse library for row ${
                                                                    i + 1
                                                                }`}
                                                                onClick={() =>
                                                                    setLibraryRow(
                                                                        i,
                                                                    )}
                                                            >
                                                                Browse library
                                                            </ActionButton>
                                                            <ActionButton
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={rowActivities(row).length >= 100}
                                                                aria-label={`Custom activity for row ${i + 1}`}
                                                                onClick={() => editActivities(
                                                                    i,
                                                                    [...rowActivities(row), { kind: "custom", text: "" }],
                                                                )}
                                                            >
                                                                Custom
                                                            </ActionButton>
                                                        </div>

                                                    </>
                                                )}
                                        </td>
                                        <td className="border-b border-secondary/20 p-3 align-middle">
                                            <fieldset
                                                aria-label={`Pool location ${i + 1}`}
                                                className="mx-auto flex min-w-40 flex-col gap-2"
                                            >
                                                {(["Lane", "Shallow end", "Deep end"] as const).map((location) => (
                                                    <label
                                                        key={location}
                                                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                                                            selectedLocation === location
                                                                ? "border-primary bg-primary/10 text-secondary"
                                                                : "border-secondary/30 bg-accent text-secondary hover:bg-bg"
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`pool-location-${i}`}
                                                            value={location}
                                                            checked={selectedLocation === location}
                                                            onChange={() => edit(i, { location })}
                                                            className="h-4 w-4 accent-secondary"
                                                        />
                                                        {location}
                                                    </label>
                                                ))}
                                            </fieldset>
                                        </td>
                                        <td className="border-b border-secondary/20 p-3 align-middle">
                                            <DurationPicker
                                                value={row.duration}
                                                rowNumber={i + 1}
                                                onChange={(duration) =>
                                                    edit(i, { duration })}
                                            />
                                        </td>
                                        <td className="relative w-14 border-b border-secondary/20 p-0">
                                            <button
                                                type="button"
                                                aria-label={`Delete row ${
                                                    i + 1
                                                }`}
                                                className="absolute inset-0 flex h-full w-full items-center justify-center bg-danger text-accent transition-colors hover:bg-dangerHover focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                                                onClick={() => {
                                                    setNotice("");
                                                    setError("");
                                                    setRows((current) =>
                                                        current.filter((
                                                            _,
                                                            index,
                                                        ) => index !== i)
                                                    );
                                                }}
                                            >
                                                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="border-t border-secondary/20">
                                <td colSpan={6} className="p-0">
                                    <button
                                        type="button"
                                        disabled={rows.length >= 200}
                                        className="flex w-full items-center justify-center gap-2 bg-bg px-4 py-3 text-sm font-semibold text-secondary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-bg"
                                        onClick={() => {
                                            setError("");
                                            setRows((current) => [...current, {
                                                skill: "",
                                                activity: "",
                                                location: "Lane",
                                                duration: 5,
                                            }]);
                                        }}
                                    >
                                        <PlusIcon className="h-4 w-4" aria-hidden="true" />
                                        Add activity
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="h-3 w-full min-w-[960px] bg-primary" aria-hidden="true" />
                </div>
            </fieldset>
            {libraryRow !== null && rows[libraryRow] && (
                <ActivityLibraryModal
                    selectedSkill={skills.find((skill) =>
                        skill.name === rows[libraryRow].skill
                    )}
                    onClose={() => setLibraryRow(null)}
                    onUse={(activity) => {
                        editActivities(libraryRow, [
                            ...rowActivities(rows[libraryRow]),
                            { kind: "library", text: activityText(activity) },
                        ]);
                        setLibraryRow(null);
                    }}
                />
            )}
            {workoutRow !== null && rows[workoutRow] &&
                isWorkoutSkill(rows[workoutRow].skill) && (
                <WorkoutBuilderModal
                    onClose={() => setWorkoutRow(null)}
                    onUse={(workout) => {
                        edit(workoutRow, {
                            workout,
                            activity: workoutText(workout),
                            activities: undefined,
                        });
                        setWorkoutRow(null);
                    }}
                />
            )}
        </div>
    );
}
export default function LessonPlans() {
    return (
        <PlanSelection title="Lesson Plans" unframed>
            {(s, c, w) => (
                <LessonEditor
                    key={`${s.id}:${c.id}:${w}`}
                    sessionId={s.id}
                    classId={c.id}
                    week={w}
                    level={c.level}
                />
            )}
        </PlanSelection>
    );
}
