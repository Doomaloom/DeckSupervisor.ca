import { expect, it } from "vitest";
import type { LessonRow } from "../../../lib/serverApi";
import { activities, activityText } from "../../../features/instructor/ActivityLibrary/activityLibrary";
import { printedPlanRows } from "./lessonPlanContent";
const drill = activities.find((activity) => activity.title === "Front crawl: Torpedo kicking")!;
const second = activities.find((activity) => activity.title === "Front crawl: Side kicking")!;
const row: LessonRow = { skill: "Front crawl", activity: "", location: "Lane 2", duration: 10, equipment: ["Noodles"] };

it("keeps all drills in one planner row with combined equipment and one duration", () => {
    const rows = printedPlanRows([{ ...row, activities: [{ kind: "library", text: activityText(drill) }, { kind: "library", text: activityText(second) }] }]);
    expect(rows).toEqual([{
        skill: row.skill,
        activities: [
            { title: "Torpedo kicking", explanation: drill.instructions },
            { title: "Side kicking", explanation: second.instructions },
        ],
        equipment: ["Noodles", drill.equipment], location: row.location, duration: "10",
    }]);
});
it("recognizes boundaries in historical flattened library activities", () => {
    const result = printedPlanRows([{ ...row, activity: `${activityText(drill)}\n\n${activityText(second)}` }]);
    expect(result).toHaveLength(1);
    expect(result[0].activities).toHaveLength(2);
    expect(result[0].activities[0].title).toBe("Torpedo kicking");
    expect(result[0].activities[1].explanation).toBe(second.instructions);
    expect(result[0].activities[0].explanation).not.toMatch(/Suitable for:|Equipment:/);
});
it("preserves free-form activities, named custom activities, workouts and empty skill rows", () => {
    expect(printedPlanRows([{ ...row, activity: "Practice carefully." }])[0].activities[0]).toMatchObject({ title: "", explanation: "Practice carefully." });
    expect(printedPlanRows([{ ...row, activities: [{ kind: "custom", text: "Custom game\n\nTake turns practising.\nKeep watching the group." }] }])[0].activities[0]).toMatchObject({ title: "Custom game", explanation: "Take turns practising.\nKeep watching the group." });
    expect(printedPlanRows([{ ...row, activity: "Warm-up\n4 x 25 m\nRest 20 seconds" }])[0].activities[0]).toMatchObject({ title: "Warm-up", explanation: "4 x 25 m\nRest 20 seconds" });
    expect(printedPlanRows([row])).toEqual([{ skill: row.skill, activities: [{ title: "", explanation: "" }], equipment: row.equipment, location: row.location, duration: "10" }]);
});
it("uses structured boundaries and deduplicates manual and embedded equipment", () => {
    const [printed] = printedPlanRows([{ ...row, activity: "Outdated flattened content", activities: [{ kind: "library", text: "Dry land: Warm-up\n\nSuitable for: Swimmer 1\n\nEquipment: noodles\n\nStretch carefully." }] }]);
    expect(printed.activities[0].title).toBe("Warm-up");
    expect(printed.activities[0].explanation).toBe("Stretch carefully.");
    expect(printed.equipment).toEqual(["noodles"]);
});

it("preserves separate planner rows even when they select the same skill", () => {
    const result = printedPlanRows([row, { ...row, duration: 5, location: "Shallow end" }]);
    expect(result).toHaveLength(2);
    expect(result.map(({ duration }) => duration)).toEqual(["10", "5"]);
});
