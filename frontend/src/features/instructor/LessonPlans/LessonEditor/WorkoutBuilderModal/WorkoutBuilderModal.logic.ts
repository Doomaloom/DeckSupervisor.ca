import { useEffect, useId, useRef, useState } from "react";

import { newWorkout, type Workout, type WorkoutSection, workoutSections, type WorkoutSet } from "../../../../../shared/workouts/workout";

export const activities = [
    "Choice of stroke",
    "Front crawl",
    "Back crawl",
    "Breaststroke",
    "Mixed strokes",
    "Flutter kick",
    "Whip kick",
    "6-kick switch side glides",
];
export function useWorkoutBuilderModalLogic({ initialWorkout, onUse, onClose }: {
    initialWorkout?: Workout;
    onUse: (workout: Workout) => void;
    onClose: () => void;
}) {
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
    return {
        view: "ready" as const,
        dialogRef,
        titleId,
        close,
        draft,
        setError,
        setDraft,
        age,
        setAge,
        update,
        edit,
        setCount,
        error,
        onUse,
    };

}
