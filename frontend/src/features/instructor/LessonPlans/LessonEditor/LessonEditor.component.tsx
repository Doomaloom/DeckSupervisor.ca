import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ActionButton, Notice, Select, Textarea, } from "../../../../general-components";
import { workoutText } from "../../../../shared/workouts/workout";
import ActivityLibraryModal from "../../ActivityLibrary/ActivityLibraryModal/ActivityLibraryModal.component";
import { activityText } from "../../ActivityLibrary/activityLibrary";
import DurationPicker from "./DurationPicker/DurationPicker.component";
import WorkoutBuilderModal from "./WorkoutBuilderModal/WorkoutBuilderModal.component";
import { curriculumLevels, isWorkoutSkill } from "../lessonSkills";
import { rowActivities, useLessonEditorLogic } from "./LessonEditor.logic";
export function LessonEditor(props: {
    sessionId: string;
    classId: string;
    week: string;
    level: string;
    lessonDuration: number;
}) {
    const viewModel = useLessonEditorLogic(props);
    if (viewModel.view === "loading") {
        return <p role="status">Loading saved lesson plan…</p>;
    }
    if (viewModel.view === "loadError") {
        const { error, setRetry } = viewModel;
        return (
            <Notice tone="danger" role="alert">
                {error}{" "}
                <ActionButton onClick={() => setRetry((v) => v + 1)}>
                    Retry
                </ActionButton>
            </Notice>
        );
    }
    const {
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
        dropPending,
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
    } = viewModel;
    return (
        <div className="flex flex-col gap-4">
            {error && (
                <Notice tone="danger" role="alert">
                    {error} Your draft is retained.
                </Notice>
            )}
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
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="border-b border-secondary/20 p-3 align-middle"
                                    >
                                        {h}
                                    </th>
                                ))}
                                <th scope="col" className="border-b border-secondary/20 p-3 align-middle">
                                    <span className="sr-only">Duration: </span>
                                    <span className="block whitespace-nowrap">
                                        {totalDuration}{lessonDuration > 0 ? ` / ${lessonDuration}` : ""} min planned
                                    </span>
                                </th>
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
                                            ? `relative z-10 bg-accent shadow-xl ring-2 ring-primary ${drag.settling
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
                                                aria-label={`Reorder row ${i + 1
                                                    }`}
                                                aria-describedby={dragHelpId}
                                                disabled={rows.length < 2}
                                                className="mx-auto flex h-11 w-11 touch-none select-none items-center justify-center rounded-lg text-secondary hover:bg-secondary/10 focus-visible:outline focus-visible:outline-2 disabled:opacity-40 cursor-grab active:cursor-grabbing"
                                                onKeyDown={(event) => handleRowKeyDown(i, event)}
                                                onPointerDown={(event) => handleRowPointerDown(i, event)}
                                                onPointerMove={(event) => handleRowPointerMove(i, event)}
                                                onPointerUp={(event) => handleRowPointerUp(i, event)}
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
                                                            aria-label={`Workout summary ${i + 1
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
                                                                        aria-label={`Use custom workout for row ${i + 1
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
                                                                    aria-label={`Convert workout in row ${i + 1
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
                                                                aria-label={`Browse library for row ${i + 1
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
                                                    <button
                                                        key={location}
                                                        type="button"
                                                        aria-pressed={selectedLocation === location}
                                                        onClick={() => {
                                                            if (selectedLocation !== location) edit(i, { location });
                                                        }}
                                                        className={`flex items-center justify-center rounded-2xl border-2 px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedLocation === location
                                                            ? "border-secondary bg-secondary text-accent shadow-sm"
                                                            : "border-secondary/20 bg-accent text-secondary hover:border-primary"
                                                            }`}
                                                    >
                                                        {location}
                                                    </button>
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
                                                aria-label={`Delete row ${i + 1
                                                    }`}
                                                className="absolute inset-0 flex h-full w-full items-center justify-center bg-danger text-accent transition-colors hover:bg-dangerHover focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                                                onClick={() => {
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
