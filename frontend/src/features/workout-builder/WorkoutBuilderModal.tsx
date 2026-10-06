import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ActionButton,
    Notice,
    Select,
    Textarea,
    TextInput,
} from "../../general-components";
import {
    newSet,
    newWorkout,
    sectionDistance,
    sectionLabels,
    type Workout,
    workoutDistance,
    workoutError,
    type WorkoutSection,
    workoutSections,
    type WorkoutSet,
    workoutText,
} from "./workout";
import { workoutAgeRanges, workoutPresets } from "./workoutPresets";

const activities = [
    "Choice of stroke",
    "Front crawl",
    "Back crawl",
    "Breaststroke",
    "Mixed strokes",
    "Flutter kick",
    "Whip kick",
    "6-kick switch side glides",
];
export default function WorkoutBuilderModal(
    { initialWorkout, onUse, onClose }: {
        initialWorkout?: Workout;
        onUse: (workout: Workout) => void;
        onClose: () => void;
    },
) {
    const [draft, setDraft] = useState<Workout>(() =>
        structuredClone(initialWorkout || newWorkout())
    );
    const baseline = useRef(JSON.stringify(draft));
    const [age, setAge] = useState("All");
    const [error, setError] = useState("");
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const trigger = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const dialog = dialogRef.current!;
        dialog.showModal();
        return () => {
            dialog.close();
            trigger?.focus();
        };
    }, []);
    function close() {
        if (
            JSON.stringify(draft) !== baseline.current &&
            !window.confirm("Discard changes in the workout builder?")
        ) return;
        onClose();
    }
    function update(section: WorkoutSection, sets: WorkoutSet[]) {
        setError("");
        setDraft((current) => ({
            ...current,
            sections: { ...current.sections, [section]: sets },
        }));
    }
    function edit(
        section: WorkoutSection,
        index: number,
        patch: Partial<WorkoutSet>,
    ) {
        update(
            section,
            draft.sections[section].map((set, i) =>
                i === index ? { ...set, ...patch } : set
            ),
        );
    }
    const setCount = workoutSections.reduce(
        (n, key) => n + draft.sections[key].length,
        0,
    );
    return createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                close();
            }}
            className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto overscroll-contain rounded-2xl border border-secondary/20 bg-bg p-0 text-secondary shadow-xl backdrop:bg-black/50"
        >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-secondary/20 bg-bg p-4 md:px-6">
                <h2 id={titleId} className="text-2xl font-semibold">
                    Workout builder
                </h2>
                <ActionButton
                    variant="outline"
                    onClick={close}
                    aria-label="Close workout builder"
                >
                    Close
                </ActionButton>
            </div>
            <div className="space-y-6 p-4 md:p-6">
                <p>
                    Choose a PDF preset or create custom sets for each part of
                    your workout. Presets can be edited.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-semibold">
                        Workout title<TextInput
                            className="block w-full"
                            maxLength={200}
                            value={draft.title}
                            onChange={(event) => {
                                setError("");
                                setDraft({
                                    ...draft,
                                    title: event.target.value,
                                });
                            }}
                        />
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                        Preset age range<Select
                            className="block w-full"
                            value={age}
                            onChange={(event) => setAge(event.target.value)}
                        >
                            <option>All</option>
                            {workoutAgeRanges.map((value) => (
                                <option key={value}>{value}</option>
                            ))}
                        </Select>
                    </label>
                </div>
                {workoutSections.map((section) => (
                    <section
                        key={section}
                        aria-label={sectionLabels[section]}
                        className="space-y-4 rounded-2xl border border-secondary/20 bg-accent p-4"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xl font-semibold">
                                {sectionLabels[section]}
                            </h3>
                            <span>
                                {sectionDistance(draft.sections[section]) || 0}
                                {" "}
                                m
                            </span>
                        </div>
                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                            <label className="min-w-0 flex-1 space-y-1 text-sm font-semibold">
                                Choose {sectionLabels[section].toLowerCase()}
                                {" "}
                                preset<Select
                                    className="block w-full"
                                    value=""
                                    onChange={(event) => {
                                        const preset = workoutPresets.find((
                                            value,
                                        ) => value.id === event.target.value);
                                        if (
                                            !preset ||
                                            (draft.sections[section].length >
                                                    0 &&
                                                !window.confirm(
                                                    `Replace the sets in ${
                                                        sectionLabels[section]
                                                            .toLowerCase()
                                                    }?`,
                                                ))
                                        ) return;
                                        update(
                                            section,
                                            structuredClone(preset.sets),
                                        );
                                    }}
                                >
                                    <option value="">
                                        Select a PDF preset
                                    </option>
                                    {workoutPresets.filter((preset) =>
                                        preset.section === section &&
                                        (age === "All" ||
                                            preset.age === "All" ||
                                            preset.age === age)
                                    ).map((preset) => (
                                        <option
                                            key={preset.id}
                                            value={preset.id}
                                        >
                                            {preset.title} · {preset.age}{" "}
                                            · scan page {preset.sourcePage}
                                        </option>
                                    ))}
                                </Select>
                            </label>
                            <ActionButton
                                variant="outline"
                                onClick={() => {
                                    if (
                                        draft.sections[section].length &&
                                        !window.confirm(
                                            `Replace ${
                                                sectionLabels[section]
                                                    .toLowerCase()
                                            } with custom sets?`,
                                        )
                                    ) return;
                                    update(section, [newSet()]);
                                }}
                            >
                                Create custom{" "}
                                {sectionLabels[section].toLowerCase()}
                            </ActionButton>
                        </div>
                        {!draft.sections[section].length && (
                            <p className="text-sm">
                                Choose a preset or create custom sets to
                                complete this section.
                            </p>
                        )}
                        {draft.sections[section].map((set, index) => {
                            const label = `${sectionLabels[section]} ${
                                section === "mainSet" ? "" : "set "
                            }${index + 1}`;
                            return (
                                <div
                                    key={index}
                                    className="space-y-3 rounded-xl border border-secondary/20 bg-bg p-3"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <strong>{label}</strong>
                                        <div className="flex gap-2">
                                            <ActionButton
                                                size="sm"
                                                variant="ghost"
                                                disabled={index === 0}
                                                aria-label={`Move ${label} up`}
                                                onClick={() => {
                                                    const sets = [
                                                        ...draft
                                                            .sections[section],
                                                    ];
                                                    [
                                                        sets[index - 1],
                                                        sets[index],
                                                    ] = [
                                                        sets[index],
                                                        sets[index - 1],
                                                    ];
                                                    update(section, sets);
                                                }}
                                            >
                                                ↑
                                            </ActionButton>
                                            <ActionButton
                                                size="sm"
                                                variant="ghost"
                                                disabled={index ===
                                                    draft.sections[section]
                                                            .length - 1}
                                                aria-label={`Move ${label} down`}
                                                onClick={() => {
                                                    const sets = [
                                                        ...draft
                                                            .sections[section],
                                                    ];
                                                    [
                                                        sets[index],
                                                        sets[index + 1],
                                                    ] = [
                                                        sets[index + 1],
                                                        sets[index],
                                                    ];
                                                    update(section, sets);
                                                }}
                                            >
                                                ↓
                                            </ActionButton>
                                            <ActionButton
                                                size="sm"
                                                variant="danger"
                                                aria-label={`Delete ${label}`}
                                                onClick={() =>
                                                    update(
                                                        section,
                                                        draft.sections[section]
                                                            .filter((_, i) =>
                                                                i !== index
                                                            ),
                                                    )}
                                            >
                                                Delete
                                            </ActionButton>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <label className="space-y-1 text-sm">
                                            Repetitions<TextInput
                                                className="block w-full"
                                                aria-label={`${label} repetitions`}
                                                type="number"
                                                min={1}
                                                max={1000}
                                                step={1}
                                                value={set.repetitions}
                                                onChange={(event) =>
                                                    edit(section, index, {
                                                        repetitions: Number(
                                                            event.target.value,
                                                        ),
                                                    })}
                                            />
                                        </label>
                                        <label className="space-y-1 text-sm">
                                            Distance per repetition
                                            (m)<TextInput
                                                className="block w-full"
                                                aria-label={`${label} distance`}
                                                type="number"
                                                min={1}
                                                max={10000}
                                                step={1}
                                                value={set.distance}
                                                onChange={(event) =>
                                                    edit(section, index, {
                                                        distance: Number(
                                                            event.target.value,
                                                        ),
                                                    })}
                                            />
                                        </label>
                                        <label className="space-y-1 text-sm">
                                            Stroke / drill<Select
                                                className="block w-full"
                                                aria-label={`${label} activity`}
                                                value={activities.includes(
                                                        set.activity,
                                                    )
                                                    ? set.activity
                                                    : "custom"}
                                                onChange={(event) =>
                                                    edit(section, index, {
                                                        activity: event.target
                                                                .value ===
                                                                "custom"
                                                            ? ""
                                                            : event.target
                                                                .value,
                                                    })}
                                            >
                                                {activities.map((value) => (
                                                    <option key={value}>
                                                        {value}
                                                    </option>
                                                ))}
                                                <option value="custom">
                                                    Custom activity
                                                </option>
                                            </Select>
                                        </label>
                                        <label className="space-y-1 text-sm">
                                            Timing<Select
                                                className="block w-full"
                                                aria-label={`${label} timing`}
                                                value={set.timing?.kind ||
                                                    "none"}
                                                onChange={(event) =>
                                                    edit(section, index, {
                                                        timing: event.target
                                                                .value ===
                                                                "none"
                                                            ? undefined
                                                            : {
                                                                kind: event
                                                                    .target
                                                                    .value as
                                                                        | "rest"
                                                                        | "interval",
                                                                seconds:
                                                                    set.timing
                                                                        ?.seconds ||
                                                                    20,
                                                            },
                                                    })}
                                            >
                                                <option value="none">
                                                    Unspecified
                                                </option>
                                                <option value="rest">
                                                    Rest after each repetition
                                                </option>
                                                <option value="interval">
                                                    Start every…
                                                </option>
                                            </Select>
                                        </label>
                                        {!activities.includes(set.activity) && (
                                            <label className="space-y-1 text-sm sm:col-span-2">
                                                Custom activity<TextInput
                                                    className="block w-full"
                                                    aria-label={`${label} custom activity`}
                                                    maxLength={200}
                                                    value={set.activity}
                                                    onChange={(event) =>
                                                        edit(section, index, {
                                                            activity:
                                                                event.target
                                                                    .value,
                                                        })}
                                                />
                                            </label>
                                        )}
                                        {set.timing && (
                                            <label className="space-y-1 text-sm">
                                                {set.timing.kind === "rest"
                                                    ? "Rest"
                                                    : "Send-off interval"}{" "}
                                                (seconds)<TextInput
                                                    className="block w-full"
                                                    aria-label={`${label} timing seconds`}
                                                    type="number"
                                                    min={1}
                                                    max={3600}
                                                    step={1}
                                                    value={set.timing.seconds}
                                                    onChange={(event) =>
                                                        edit(section, index, {
                                                            timing: {
                                                                kind:
                                                                    set.timing!
                                                                        .kind,
                                                                seconds: Number(
                                                                    event.target
                                                                        .value,
                                                                ),
                                                            },
                                                        })}
                                                />
                                            </label>
                                        )}
                                    </div>
                                    <label className="block space-y-1 text-sm">
                                        Notes / equipment<Textarea
                                            className="block w-full"
                                            aria-label={`${label} notes`}
                                            maxLength={1000}
                                            value={set.notes}
                                            onChange={(event) =>
                                                edit(section, index, {
                                                    notes: event.target.value,
                                                })}
                                        />
                                    </label>
                                </div>
                            );
                        })}
                        <ActionButton
                            variant="outline"
                            disabled={setCount >= 100}
                            onClick={() => update(section, [
                                ...draft.sections[section],
                                newSet(),
                            ])}
                        >
                            Add {sectionLabels[section].toLowerCase()} set
                        </ActionButton>
                    </section>
                ))}
                <section aria-label="Workout preview" className="space-y-3">
                    <h3 className="text-xl font-semibold">
                        Preview · {workoutDistance(draft) || 0} m total
                    </h3>
                    <p className="whitespace-pre-wrap break-words rounded-xl border border-secondary/20 bg-accent p-4">
                        {workoutText(draft)}
                    </p>
                </section>
                <p className="text-sm">
                    Set the lesson duration in the lesson row. The distance
                    total does not estimate swimming time.
                </p>
                {error && <Notice tone="danger" role="alert">{error}</Notice>}
                <ActionButton
                    variant="primary"
                    onClick={() => {
                        const message = workoutError(draft);
                        setError(message);
                        if (!message) onUse(structuredClone(draft));
                    }}
                >
                    Use workout
                </ActionButton>
            </div>
        </dialog>,
        document.body,
    );
}
