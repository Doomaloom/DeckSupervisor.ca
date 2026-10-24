import { expect, it } from "vitest";
import type { InstructorClass, InstructorSession, LessonPlan } from "../../lib/serverApi";
import { curriculumLevels } from "../../features/instructor/LessonPlans/lessonSkills";
import { buildLessonPlanMarkingDocument } from "./buildLessonPlanMarkingDocument";

const level = curriculumLevels.find((entry) => entry.id === "LittleSplash1")!;
const session = { weeks: ["2026-10-05"], location: "Test Pool", session_day: "Mo", session_season: "Fall", session_year: 2026 } as InstructorSession;
const course = { id: "a", code: "CLASS-A", level: level.name, instructor: "Alex", start_time: "09:00", end_time: "09:30" } as InstructorClass;
const plan = { week: session.weeks[0], rows: [{ skill: level.skills[0].name, activity: "Practice <safely>", duration: 5, location: "Lane", equipment: ["Noodles"] }] } as LessonPlan;

it("interleaves each plan with every marking continuation sheet before the next class", () => {
    const document = buildLessonPlanMarkingDocument(session, [
        { course, plan, students: Array.from({ length: 29 }, (_, i) => ({ name: `Student ${i + 1}` })) },
        { course: { ...course, id: "b", code: "CLASS-B" }, plan },
    ]);
    expect(Array.from(document.body.children, (page) => [page.classList.contains("lesson-plan-print") ? "plan" : "marking", (page as HTMLElement).dataset.classId])).toEqual([
        ["plan", "a"], ["marking", "a"], ["marking", "a"], ["marking", "a"], ["plan", "b"], ["marking", "b"],
    ]);
    expect(document.querySelector('[data-class-id="a"].marking-page')!.textContent).toContain("Student 1");
    expect(document.querySelectorAll(".marking-page")[2].textContent).toContain("Student 29");
    expect(document.querySelector(".lesson-plan-print")!.textContent).toContain("Noodles");
    expect(document.querySelector(".lesson-plan-print")!.textContent).toContain("Practice <safely>");
    expect(document.querySelector("safely")).toBeNull();
    expect(document.querySelector(".plan-subskills")!.textContent).toContain(level.skills[0].subskills[0].text);
});

it("keeps a long activity in one logical table row and retains the entire explanation", () => {
    const activity = "Practice technique carefully. ".repeat(500);
    const document = buildLessonPlanMarkingDocument(session, [{ course, plan: { ...plan, rows: [{ ...plan.rows[0], activity, equipment: [] }] } }]);
    const rows = Array.from(document.querySelectorAll(".lesson-plan-print tbody tr"));
    expect(rows).toHaveLength(1);
    expect(rows[0].classList.contains("plan-long-activity")).toBe(true);
    expect(rows[0].querySelector(".plan-activity-explanation")!.textContent).toBe(activity.trim());
    expect(rows[0].children[2].textContent).toBe("Lane");
});

it("groups all drills inside one planner row with a single skill, equipment list and duration", () => {
    const document = buildLessonPlanMarkingDocument(session, [{ course, plan: { ...plan, rows: [{ ...plan.rows[0], activities: [
        { kind: "library", text: "Front crawl: Torpedo kicking\n\nSuitable for: Swimmer 1\n\nEquipment: Kickboard\n\nKick in streamline." },
        { kind: "custom", text: "Partner game\n\nTake turns." },
    ] }] } }]);
    const rows = Array.from(document.querySelectorAll(".lesson-plan-print tbody tr"));
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelectorAll("strong")).toHaveLength(1);
    expect(rows[0].querySelector("strong")!.textContent).toBe(plan.rows[0].skill);
    expect(Array.from(rows[0].querySelectorAll("em"), (element) => element.textContent)).toEqual(["Torpedo kicking", "Partner game"]);
    expect(rows[0].querySelectorAll(".plan-activity")).toHaveLength(2);
    expect(rows[0].querySelector("em")!.textContent).toBe("Torpedo kicking");
    expect(rows[0].children[0].textContent).not.toMatch(/Suitable for|Equipment:|Front crawl:/);
    expect(rows[0].children[1].textContent).toBe("Noodles\nKickboard");
    expect(rows[0].children[3].textContent).toBe("5");
});

it("keeps four columns even when activities are empty and handles saved empty plans", () => {
    const document = buildLessonPlanMarkingDocument(session, [{ course, plan: { ...plan, rows: [{ ...plan.rows[0], activity: "", equipment: [] }] } }]);
    expect(document.querySelectorAll(".lesson-plan-print th")).toHaveLength(4);
    const empty = buildLessonPlanMarkingDocument(session, [{ course, plan: { ...plan, rows: [] } }]);
    expect(empty.body.textContent).toContain("No activities in this saved plan.");
    expect(empty.querySelectorAll(".marking-page")).toHaveLength(1);
    expect(() => buildLessonPlanMarkingDocument(session, [])).toThrow("No saved lesson plans");
});
