import catalog from "../activity-library/activities.json";
import { expect, it } from "vitest";
import {
    newSet,
    newWorkout,
    sectionDistance,
    workoutDistance,
    workoutError,
    workoutText,
} from "./workout";
import { workoutComponentPresets, workoutPresets } from "./workoutPresets";

it("preserves PDF distances and differentiates rest from send-offs", () => {
    const workout = newWorkout();
    workout.sections.warmUp =
        workoutPresets.find((p) => p.id === "young-1-warm")!.sets;
    workout.sections.mainSet =
        workoutPresets.find((p) => p.id === "young-1-main")!.sets;
    workout.sections.coolDown =
        workoutPresets.find((p) => p.id === "young-1-cool")!.sets;
    expect(sectionDistance(workout.sections.mainSet)).toBe(200);
    expect(workoutDistance(workout)).toBe(500);
    expect(workoutError(workout)).toBe("");
    expect(workoutText(workout)).toContain(
        "rest 20 seconds after each repetition",
    );
    expect(workoutText(workout)).toContain("start every 1:10");
    expect(workoutText(workout)).toContain("Total distance: 500 m");
});
it("all source presets produce valid sections without sharing editable state", () => {
    expect(workoutPresets).toHaveLength(30);
    expect(new Set(workoutPresets.map((p) => p.id)).size).toBe(30);
    for (const preset of workoutPresets) {
        const workout = newWorkout();
        workout.sections = {
            warmUp: [newSet()],
            mainSet: [newSet()],
            coolDown: [newSet()],
        };
        workout.sections[preset.section] = structuredClone(preset.sets);
        expect(workoutError(workout), preset.id).toBe("");
        workout.sections[preset.section][0].distance = 999;
        expect(preset.sets[0].distance).not.toBe(999);
    }
});
it("rejects incomplete, fractional, oversized and invalid timed workouts", () => {
    const workout = newWorkout();
    expect(workoutError(workout)).toMatch(/warm-up/);
    workout.sections = {
        warmUp: [newSet()],
        mainSet: [newSet()],
        coolDown: [newSet()],
    };
    workout.sections.mainSet[0].distance = 1.5;
    expect(workoutError(workout)).toMatch(/whole metres/);
    workout.sections.mainSet[0].distance = 25;
    workout.sections.mainSet[0].timing = { kind: "rest", seconds: 0 };
    expect(workoutError(workout)).toMatch(/seconds/);
    delete workout.sections.mainSet[0].timing;
    workout.sections.mainSet = Array.from({ length: 99 }, newSet);
    expect(workoutError(workout)).toMatch(/100 sets/);
    workout.sections.mainSet = Array.from(
        { length: 20 },
        () => ({ ...newSet(), notes: "泳".repeat(500) }),
    );
    expect(workoutError(workout)).toMatch(/10,000-byte/);
});

it("matches the standalone workout components in the activity library", () => {
    const components = catalog.filter((activity) =>
        activity.category === "Workouts" &&
        !activity.title.includes("Interval workout")
    );
    expect(workoutComponentPresets.map((preset) => preset.id).sort()).toEqual(
        components.map((activity) => activity.id).sort(),
    );
    for (const preset of workoutComponentPresets) {
        const activity = components.find((entry) => entry.id === preset.id)!;
        expect(preset.title).toBe(activity.title);
        expect(preset.sourcePage).toBe(activity.sourcePages[0]);
    }
    expect(workoutComponentPresets.filter((p) => p.section === "warmUp")
        .map((p) => sectionDistance(p.sets))).toEqual([200, 200, 250]);
    expect(workoutComponentPresets.filter((p) => p.section === "coolDown")
        .map((p) => sectionDistance(p.sets))).toEqual([200, 200, 150]);
});
