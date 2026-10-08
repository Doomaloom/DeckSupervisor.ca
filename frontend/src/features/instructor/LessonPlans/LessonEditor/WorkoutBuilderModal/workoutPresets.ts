import type { WorkoutSection, WorkoutSet } from "../../../../../shared/workouts/workout";
import activityCatalog from "../../../ActivityLibrary/activities.json";
export type WorkoutPreset = {
    id: string;
    title: string;
    section: WorkoutSection;
    age: string;
    sourcePage: number;
    sourceKind: "component" | "workout";
    sets: WorkoutSet[];
};
const s = (
    repetitions: number,
    distance: number,
    activity: string,
    kind?: "rest" | "interval",
    seconds?: number,
    notes = "",
): WorkoutSet => ({
    repetitions,
    distance,
    activity,
    notes,
    ...(kind && seconds ? { timing: { kind, seconds } } : {}),
});
const presets: WorkoutPreset[] = [];
function add(
    id: string,
    title: string,
    section: WorkoutSection,
    age: string,
    sourcePage: number,
    sets: WorkoutSet[],
    sourceKind: WorkoutPreset["sourceKind"] = "component",
) {
    presets.push({ id, title, section, age, sourcePage, sets, sourceKind });
}
function addComponent(
    activityId: string,
    section: WorkoutSection,
    sets: WorkoutSet[],
) {
    const activity = activityCatalog.find((entry) => entry.id === activityId);
    if (!activity || activity.category !== "Workouts") {
        throw new Error(`Missing workout component: ${activityId}`);
    }
    add(
        activity.id,
        activity.title,
        section,
        "suitability" in activity ? activity.suitability ?? "All" : "All",
        activity.sourcePages[0],
        sets,
    );
}
addComponent("workouts-warm-up-1", "warmUp", [
    s(1, 200, "Mixed strokes", undefined, undefined,
        "Easy pace; change stroke every 25 or 50 m."),
]);
addComponent("workouts-warm-up-2", "warmUp", [
    s(4, 50, "Choice of stroke", undefined, undefined,
        "Progress from relaxed to slightly faster, strong effort, then fast."),
]);
addComponent("workouts-warm-up-3", "warmUp", [
    s(1, 25, "Choice of stroke", undefined, undefined, "Relaxed."),
    s(1, 50, "Choice of stroke", undefined, undefined, "Slightly faster."),
    s(1, 75, "Choice of stroke", undefined, undefined, "Strong effort."),
    s(1, 100, "Choice of stroke", undefined, undefined, "Fast."),
]);
addComponent("workouts-cool-down-1", "coolDown", [
    s(1, 200, "Mixed strokes", undefined, undefined,
        "Easy pace; change stroke every 25 or 50 m."),
]);
addComponent("workouts-cool-down-2", "coolDown", [
    s(4, 50, "Choice of stroke", undefined, undefined,
        "Easy swimming; focus on distance per stroke."),
]);
addComponent("workouts-cool-down-3", "coolDown", [
    s(6, 25, "Choice of stroke", "rest", 25),
]);
const young = "11 years and under",
    middle = "11-14 years",
    older = "13-18 years";
addComponent("workouts-11-years-under-main-set-a", "mainSet", [
    s(4, 25, "Front crawl", "interval", 60),
    s(2, 25, "Flutter kick", "rest", 20, "With a kickboard."),
    s(2, 25, "Flutter kick", "rest", 20, "Without a board."),
    s(
        4,
        25,
        "Front crawl",
        "interval",
        60,
        "Odd lengths: closed fists. Even lengths: distance-per-stroke focus.",
    ),
]);
addComponent("workouts-11-years-under-main-set-b", "mainSet", [
    s(2, 50, "Front crawl", "interval", 100),
    ...[25, 50, 75, 75, 50, 25].map((d) =>
        s(
            1,
            d,
            "Choice of stroke",
            undefined,
            undefined,
            "Ladder: the source does not specify stroke or timing.",
        )
    ),
]);
addComponent("workouts-11-14-years-main-set-a", "mainSet", [
    s(4, 75, "Front crawl", "interval", 120),
    s(3, 50, "Front crawl", "interval", 80),
    s(2, 25, "Front crawl", "interval", 55),
]);
addComponent("workouts-11-14-years-main-set-b", "mainSet", [
    s(
        8,
        25,
        "Mixed strokes",
        undefined,
        undefined,
        "Odd lengths: breaststroke. Even lengths: back crawl.",
    ),
    s(
        2,
        75,
        "Back crawl and flutter kick",
        undefined,
        undefined,
        "Each repetition: 25 m back flutter kick, then 50 m back crawl.",
    ),
    s(
        2,
        75,
        "Breaststroke and whip kick",
        undefined,
        undefined,
        "Each repetition: 25 m whip kick without a board, then 50 m breaststroke.",
    ),
]);
addComponent("workouts-13-18-years-main-set-a", "mainSet", [
    s(3, 100, "Front crawl", "interval", 165),
    s(2, 100, "Front crawl", "interval", 155),
    s(1, 100, "Front crawl", undefined, undefined, "Sprint."),
]);
addComponent("workouts-13-18-years-main-set-b", "mainSet", [
    s(1, 25, "Front crawl", "rest", 20),
    s(1, 50, "Back crawl", "rest", 30),
    s(1, 75, "Breaststroke", "rest", 45),
    s(1, 100, "Front crawl", "rest", 60),
    s(1, 75, "Breaststroke", "rest", 45),
    s(1, 50, "Back crawl", "rest", 30),
    s(1, 25, "Front crawl", "rest", 20),
]);
function complete(
    id: string,
    title: string,
    age: string,
    warm: WorkoutSet[],
    main: WorkoutSet[],
    cool: WorkoutSet[],
) {
    add(id + "-warm", title, "warmUp", age, 24, warm, "workout");
    add(id + "-main", title, "mainSet", age, 24, main, "workout");
    add(id + "-cool", title, "coolDown", age, 24, cool, "workout");
}
const ladder = () =>
    [25, 50, 75].map((d) => s(1, d, "Choice of stroke", "rest", 20));
complete("young-1", "Interval workout 1", young, ladder(), [
    s(2, 25, "Flutter kick", "interval", 70),
    s(2, 25, "Front crawl", "interval", 60),
    s(2, 50, "Choice of stroke", "interval", 120),
], ladder());
complete(
    "young-2",
    "Interval workout 2",
    young,
    [s(4, 25, "Choice of stroke", "interval", 60)],
    [s(8, 25, "Front crawl", "interval", 55)],
    [s(4, 25, "Choice of stroke", "interval", 60)],
);
complete("middle-1", "Interval workout 1", middle, [
    s(4, 25, "Choice of stroke", "interval", 60),
], [
    s(1, 25, "Choice of stroke", "rest", 15),
    s(1, 50, "Choice of stroke", "rest", 30),
    s(1, 50, "Choice of stroke", "rest", 30),
    s(1, 25, "Choice of stroke", "rest", 15),
], [s(4, 25, "Choice of stroke", "interval", 60)]);
complete("middle-2", "Interval workout 2", middle, [
    s(1, 100, "Choice of stroke"),
], [
    s(6, 50, "Front crawl", "interval", 90),
    s(2, 25, "Flutter kick", "rest", 20, "No board; arms streamlined."),
    s(2, 25, "6-kick switch side glides", "rest", 20),
], [s(1, 100, "Choice of stroke")]);
complete("older-1", "Interval workout 1", older, [
    s(2, 25, "Choice of stroke", "rest", 20),
    s(2, 50, "Choice of stroke", "rest", 30),
], [
    s(12, 25, "Choice of stroke", "interval", 60, "Hard effort."),
    s(4, 50, "Choice of stroke", "interval", 90, "Hard effort."),
], [s(1, 100, "Choice of stroke")]);
complete("older-2", "Interval workout 2", older, [
    s(1, 200, "Choice of stroke", undefined, undefined, "Long, easy strokes."),
], [
    s(1, 25, "Front crawl", "rest", 15),
    s(1, 50, "Front crawl", "rest", 30),
    s(1, 200, "Choice of stroke", "rest", 45),
    s(1, 50, "Front crawl", "rest", 30),
    s(1, 25, "Front crawl", "rest", 15),
], [s(1, 200, "Choice of stroke")]);
export const workoutPresets = presets;
export const workoutComponentPresets = presets.filter((preset) =>
    preset.sourceKind === "component"
);
export const workoutAgeRanges = [young, middle, older];
