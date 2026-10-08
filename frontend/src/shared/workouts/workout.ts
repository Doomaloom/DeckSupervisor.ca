export const workoutSections = ["warmUp", "mainSet", "coolDown"] as const;
export type WorkoutSection = typeof workoutSections[number];
export const sectionLabels: Record<WorkoutSection, string> = {
    warmUp: "Warm-up",
    mainSet: "Main set",
    coolDown: "Cool-down",
};
export type WorkoutSet = {
    repetitions: number;
    distance: number;
    activity: string;
    notes: string;
    timing?: { kind: "rest" | "interval"; seconds: number };
};
export type Workout = {
    version: 1;
    title: string;
    sections: Record<WorkoutSection, WorkoutSet[]>;
};
export const newSet = (): WorkoutSet => ({
    repetitions: 1,
    distance: 25,
    activity: "Choice of stroke",
    notes: "",
});
export const newWorkout = (): Workout => ({
    version: 1,
    title: "Workout",
    sections: { warmUp: [], mainSet: [], coolDown: [] },
});
export function sectionDistance(sets: WorkoutSet[]) {
    return sets.reduce(
        (total, set) => total + set.repetitions * set.distance,
        0,
    );
}
export function workoutDistance(workout: Workout) {
    return workoutSections.reduce(
        (total, key) => total + sectionDistance(workout.sections[key]),
        0,
    );
}
export function workoutText(workout: Workout) {
    return [
        workout.title,
        ...workoutSections.map((key) =>
            `${sectionLabels[key]} (${sectionDistance(workout.sections[key])
            } m)\n${workout.sections[key].map((set) => {
                const timing = !set.timing
                    ? ""
                    : set.timing.kind === "rest"
                        ? `; rest ${set.timing.seconds} seconds after each repetition`
                        : `; start every ${Math.floor(set.timing.seconds / 60)
                        }:${String(set.timing.seconds % 60).padStart(2, "0")}`;
                return `${set.repetitions} × ${set.distance} m ${set.activity}${timing}${set.notes ? `\n${set.notes}` : ""
                    }`;
            }).join("\n")
            }`
        ),
        `Total distance: ${workoutDistance(workout)} m`,
    ].join("\n\n");
}
export function workoutError(workout: Workout) {
    if (!workout.title.trim() || workout.title.length > 200) {
        return "Enter a workout title of up to 200 characters.";
    }
    if (
        workoutSections.reduce(
            (n, key) => n + workout.sections[key].length,
            0,
        ) >
        100
    ) return "Use no more than 100 sets in a workout.";
    for (const key of workoutSections) {
        if (!workout.sections[key].length) {
            return `Add at least one set to ${sectionLabels[key].toLowerCase()
                }.`;
        }
        for (const set of workout.sections[key]) {
            if (
                !Number.isInteger(set.repetitions) || set.repetitions < 1 ||
                set.repetitions > 1000 || !Number.isInteger(set.distance) ||
                set.distance < 1 || set.distance > 10000
            ) {
                return "Repetitions must be 1–1,000 and distance must be 1–10,000 whole metres.";
            }
            if (
                !set.activity.trim() || set.activity.length > 200 ||
                set.notes.length > 1000
            ) {
                return "Each set needs an activity of up to 200 characters and notes of up to 1,000 characters.";
            }
            if (
                set.timing &&
                (!["rest", "interval"].includes(set.timing.kind) ||
                    !Number.isInteger(set.timing.seconds) ||
                    set.timing.seconds < 1 ||
                    set.timing.seconds > 3600)
            ) return "Timing must be between 1 and 3,600 whole seconds.";
        }
    }
    if (new TextEncoder().encode(workoutText(workout)).length > 10000) {
        return "Shorten the workout to fit the lesson plan’s 10,000-byte activity limit.";
    }
    return "";
}
