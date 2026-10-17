import { expect, it } from "vitest";
import { curriculumLevels } from "../../features/instructor/LessonPlans/lessonSkills";
import type { InstructorClass, InstructorSession, LessonPlan } from "../../lib/serverApi";
import { buildCombinedSkillMarkingDocument, buildSkillMarkingDocument, markingColumns } from "./buildSkillMarkingDocument";

const level = curriculumLevels.find((entry) => entry.id === "LittleSplash1")!;
const course = { level: level.name, code: "TEST", instructor: "Alex", start_time: "09:00", end_time: "09:30" } as InstructorClass;
const session = { session_day: "Mo", session_season: "Fall", session_year: 2026, weeks: ["2026-10-05"], location: "Test Pool" } as InstructorSession;
const plan = { week: "2026-10-05", rows: [level.skills[0], level.skills[0], level.skills[1]].map((skill) => ({ skill: skill.name })) } as LessonPlan;

it("keeps attendance name rows and rotated skill columns with only planned criteria", () => {
    const document = buildSkillMarkingDocument(session, course, plan);
    expect(document.querySelectorAll(".marking-page")).toHaveLength(1);
    const cells = Array.from(document.querySelectorAll(".marking-criterion"));
    expect(cells[0].textContent).toContain(level.skills[0].name);
    expect(cells[1].textContent).toContain(level.skills[0].subskills[0].text);
    expect(cells.filter((cell) => cell.getAttribute("data-planned") === "true")).toHaveLength(2);
    expect(document.body.textContent).not.toContain(level.skills[2].name);
    const rows = document.querySelectorAll("tr[data-generated-attendance-row]");
    expect(rows).toHaveLength(10);
    rows.forEach((row, index) => {
        expect(row.querySelector("td strong")?.textContent).toBe(`${index + 1}. `);
        expect(row.textContent).not.toContain("Absent/Present");
        expect(row.textContent).not.toContain("[Day");
        expect(row.children.length).toBe(cells.length + 1);
    });
    expect(document.querySelector('[data-field="instructor"]')?.textContent).toBe("Alex");
    expect(document.querySelector('[data-field="lesson"]')?.textContent).toContain(plan.week);
});

it("uses the saved private curriculum and reports missing subskills without inventing them", () => {
    const columns = markingColumns({ ...course, level: "Private" }, { ...plan, curriculum_level: level.id, rows: [{ skill: level.skills[0].name }, { skill: "Custom skill" }] } as LessonPlan);
    expect(columns[1].text).toContain(level.skills[0].subskills[0].text);
    expect(columns.slice(-2)).toEqual([{ text: "2. Custom skill", planned: true }, { text: "2.1 Subskills unavailable", planned: false }]);
});

it("fits a full typical curriculum on one sheet and bounds header labels", () => {
    const longPlan = { ...plan, rows: level.skills.map((skill) => ({ skill: skill.name })) } as LessonPlan;
    const document = buildSkillMarkingDocument(session, course, longPlan);
    const pages = document.querySelectorAll(".marking-page");
    expect(pages).toHaveLength(1);
    pages.forEach((page) => {
        expect(page.querySelectorAll(".marking-criterion").length).toBeLessThanOrEqual(32);
        expect(page.querySelectorAll("tr[data-generated-attendance-row]")).toHaveLength(10);
        expect(page.querySelector('[data-field="barcode"]')?.textContent).toBe("TEST");
    });
    const longText = "Custom skill ".repeat(800);
    const columns = markingColumns(course, { ...plan, rows: [{ skill: longText }] } as LessonPlan);
    expect(columns.filter((column) => column.planned).map((column) => column.text).join("")).toBe(`1. ${longText.trim()}`);
    expect(Math.max(...columns.map((column) => column.text.length))).toBeLessThanOrEqual(141);
});

it("inserts saved text safely and handles an empty saved plan", () => {
    const document = buildSkillMarkingDocument(session, { ...course, instructor: "<img src=x onerror=alert(1)>" }, { ...plan, rows: [{ skill: "<script>alert(1)</script>" }] } as LessonPlan);
    expect(document.querySelectorAll("script,img")).toHaveLength(0);
    expect(document.querySelector('[data-field="instructor"]')?.textContent).toContain("<img");
    const empty = buildSkillMarkingDocument(session, course, { ...plan, rows: [] });
    expect(empty.body.textContent).toContain("No planned skills");
    expect(empty.querySelectorAll("tr[data-generated-attendance-row]")).toHaveLength(10);
});

it("combines all classes with separate sheets and blank student names", () => {
    const document = buildCombinedSkillMarkingDocument(session, [
        { course, plan },
        { course: { ...course, code: "SECOND" }, plan },
    ]);
    const pages = document.querySelectorAll(".marking-page");
    expect(pages).toHaveLength(2);
    expect(pages[0].querySelector('[data-field="barcode"]')?.textContent).toBe("TEST");
    expect(pages[1].querySelector('[data-field="barcode"]')?.textContent).toBe("SECOND");
    expect(document.querySelectorAll("tr[data-generated-attendance-row]")).toHaveLength(20);
    expect(document.querySelectorAll("[id]")).toHaveLength(0);
});

it("fills known student names safely, and retains all students in large classes", () => {
    const students = Array.from({ length: 18 }, (_, index) => ({ name: `Student ${index + 1} <test>` }));
    const document = buildSkillMarkingDocument(session, course, plan, students);
    expect(document.querySelectorAll(".marking-page")).toHaveLength(2);
    const rows = Array.from(document.querySelectorAll("tr[data-generated-attendance-row]"));
    expect(rows).toHaveLength(18);
    expect(rows.map((row) => row.querySelector("td strong")!.textContent?.replace(/^\d+\. /, ""))).toEqual(students.map(({ name }) => name));
    expect(document.querySelectorAll("test")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("[Day");
    expect(document.body.textContent).not.toContain("Absent/Present");
});

it("continues extremely dense plans without dropping any skills or subskills", () => {
    const dense = { ...plan, rows: Array.from({ length: 40 }, (_, index) => ({ skill: `Custom skill ${index}` })) } as LessonPlan;
    const document = buildSkillMarkingDocument(session, course, dense);
    expect(document.querySelectorAll(".marking-page").length).toBeGreaterThan(1);
    expect(Array.from(document.querySelectorAll(".marking-criterion span")).map((element) => element.textContent).filter(Boolean)).toEqual(markingColumns(course, dense).map(({ text }) => text));
});
