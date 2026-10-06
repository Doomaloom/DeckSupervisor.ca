import type { WorkoutSection, WorkoutSet } from "./workout";
export type WorkoutPreset = {
    id: string;
    title: string;
    section: WorkoutSection;
    age: string;
    sourcePage: number;
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
) {
    presets.push({ id, title, section, age, sourcePage, sets });
}
add("sample-warm-up", "Sample warm-up", "warmUp", "All", 23, [
    s(
        1,
        200,
        "Mixed strokes",
        undefined,
        undefined,
        "Easy pace; change stroke every 25 or 50 m.",
    ),
    s(
        4,
        50,
        "Choice of stroke",
        undefined,
        undefined,
        "Progress from relaxed to slightly faster, strong effort, then fast.",
    ),
    s(1, 25, "Choice of stroke", undefined, undefined, "Relaxed."),
    s(1, 50, "Choice of stroke", undefined, undefined, "Slightly faster."),
    s(1, 75, "Choice of stroke", undefined, undefined, "Strong effort."),
    s(1, 100, "Choice of stroke", undefined, undefined, "Fast."),
]);
add("sample-cool-down", "Sample cool-down", "coolDown", "All", 24, [
    s(
        1,
        200,
        "Mixed strokes",
        undefined,
        undefined,
        "Easy pace; change stroke every 25 or 50 m.",
    ),
    s(
        4,
        50,
        "Choice of stroke",
        undefined,
        undefined,
        "Easy swimming; focus on distance per stroke.",
    ),
    s(6, 25, "Choice of stroke", "rest", 25),
]);
const young = "11 years and under",
    middle = "11-14 years",
    older = "13-18 years";
add("young-main-a", "Main set A", "mainSet", young, 23, [
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
add("young-main-b", "Main set B", "mainSet", young, 23, [
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
add("middle-main-a", "Main set A", "mainSet", middle, 23, [
    s(4, 75, "Front crawl", "interval", 120),
    s(3, 50, "Front crawl", "interval", 80),
    s(2, 25, "Front crawl", "interval", 55),
]);
add("middle-main-b", "Main set B", "mainSet", middle, 23, [
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
add("older-main-a", "Main set A", "mainSet", older, 24, [
    s(3, 100, "Front crawl", "interval", 165),
    s(2, 100, "Front crawl", "interval", 155),
    s(1, 100, "Front crawl", undefined, undefined, "Sprint."),
]);
add("older-main-b", "Main set B: pyramid", "mainSet", older, 24, [
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
    add(id + "-warm", title, "warmUp", age, 24, warm);
    add(id + "-main", title, "mainSet", age, 24, main);
    add(id + "-cool", title, "coolDown", age, 24, cool);
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
export const workoutAgeRanges = [young, middle, older];
