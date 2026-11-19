import { beforeEach, expect, it, vi } from "vitest";
import type { Student } from "../types/app";

const syncReportCards = vi.hoisted(() => vi.fn());
vi.mock("./serverApi", () => ({ syncReportCards }));

import { applySchematicAssignments, hasSavedSchematicAssignments, syncReportCardsForDay } from "./reportCardSync";

const student = (overrides: Partial<Student>): Student => ({
    id: overrides.name ?? "s", service_name: "Splash 7", code: "98007", day: "Thursday", time: "16:00-16:30",
    location: "Lakeside Demo Pool", schedule: "", name: "Swimmer", phone: "", instructor: "", level: "Splash 7",
    waitlist: false, ...overrides,
});
const schematic = { codes: ["98001,98007", "98002"], instructors: ["Sam Taylor", "Jordan Rivers"] };

beforeEach(() => syncReportCards.mockReset().mockResolvedValue({ status: "synced" }));

it("assigns instructors from the saved schematic by class code", () => {
    const students = [student({ name: "A", code: "98007" }), student({ name: "B", code: "98002" }), student({ name: "C", code: "99999", instructor: "Kept" })];
    expect(applySchematicAssignments(students, schematic).map((s) => s.instructor)).toEqual(["Sam Taylor", "Jordan Rivers", "Kept"]);
    expect(applySchematicAssignments(students, null)).toBe(students);
    expect(hasSavedSchematicAssignments(schematic)).toBe(true);
    expect(hasSavedSchematicAssignments({ codes: [""], instructors: [] })).toBe(false);
    expect(hasSavedSchematicAssignments(null)).toBe(false);
});

it("syncs booked swimmers and ignores waitlisted ones without an instructor", async () => {
    const booked = student({ name: "Booked", instructor: "Sam Taylor" });
    const result = await syncReportCardsForDay({
        day: "Thursday", sessionLabel: "Fall 2026", teamId: null,
        students: [booked, student({ name: "Waiting", waitlist: true })],
    });
    expect(result).toEqual({ status: "synced" });
    expect(syncReportCards).toHaveBeenCalledWith({ day: "Thursday", sessionLabel: "Fall 2026", teamId: null, students: [booked] });
});

it("blocks when a booked swimmer has no instructor", async () => {
    const result = await syncReportCardsForDay({ day: "Thursday", sessionLabel: "Fall 2026", teamId: null, students: [student({})] });
    expect(result).toEqual({ status: "blocked_unassigned" });
    expect(syncReportCards).not.toHaveBeenCalled();
});
