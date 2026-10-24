import { webcrypto } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { fetchDeviceLessonPlans, type DeviceLessonPlan } from "../../../../lib/serverApi";
import { curriculumLevels } from "../../../instructor/LessonPlans/lessonSkills";
import { classes, session, students } from "../fixtures";
import { buildCourses, buildPackage, newRegistry } from "./exportPackage";
import { loadExportPlans } from "./loadExportPlans";
vi.mock("../../../../lib/serverApi", () => ({ fetchDeviceLessonPlans: vi.fn() }));
const row = { skill: curriculumLevels.find(l => l.id === "Splash1")!.skills[0].name, activity: "Practice entry", location: "Lane", duration: 5, equipment: ["20 lb weights"] };
const plan = (overrides: Partial<DeviceLessonPlan> = {}): DeviceLessonPlan => ({ session_id: session.id, class_id: "class-one", week: "2026-09-04", code: "004201", instructor: "Alex", level: "Splash1", rows: [row, { ...row, activity: "Repeat" }], updated_at: "2026-10-01", ...overrides });
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); vi.mocked(fetchDeviceLessonPlans).mockReset().mockResolvedValue({ plans: [plan()] }); });
it("publishes ordered dated plans only with their assigned course and instructor", async () => {
 const courses = await loadExportPlans(session.id, buildCourses(session, classes, students), false);
 expect(courses[0].lessonPlans?.[0].rows.map(r => r.skillId)).toEqual(["Splash1:1", "Splash1:1"]);
 expect(courses[0].lessonPlans?.[0].rows[1].activity).toBe("Repeat");
 expect(courses[1].lessonPlans).toEqual([]);
 const result = await buildPackage(session.id, "Alex", courses, newRegistry(session.id));
 expect(result.package.courses[0].lessonPlans?.[0].rows[0].equipment).toEqual(["20 lb weights"]);
 expect(result.package.courses[0].lessonPlans?.[0].date).toBe("2026-09-04");
 expect(result.package.courses).toHaveLength(2);
});
it("filters plans to reviewed lesson dates and supports private curriculum levels", async () => {
 vi.mocked(fetchDeviceLessonPlans).mockResolvedValue({ plans: [plan({ code: "004202", curriculum_level: "Splash1" })] });
 const courses = await loadExportPlans(session.id, buildCourses(session, classes, students), false);
 expect(courses[1].lessonPlans?.[0].curriculumLevel).toBe("Splash1");
 courses[1].lessonDates = ["2026-09-11"];
 const result = await buildPackage(session.id, "Alex", courses, newRegistry(session.id));
 expect(result.package.courses[1].lessonPlans).toEqual([]);
});
it("never attaches another instructor's plan or guesses an unknown skill", async () => {
 vi.mocked(fetchDeviceLessonPlans).mockResolvedValue({ plans: [plan({ instructor: "Sam" })] });
 let courses = await loadExportPlans(session.id, buildCourses(session, classes, students), false);
 expect(courses[0].lessonPlans).toEqual([]);
 vi.mocked(fetchDeviceLessonPlans).mockResolvedValue({ plans: [plan({ rows: [{ ...row, skill: "Custom game" }] })] });
 courses = await loadExportPlans(session.id, courses, false);
 expect(courses[0].lessonPlans?.[0].rows[0].skillId).toBeUndefined();
});
it("rejects ambiguous class identities and duplicate lesson dates", async () => {
 const courses = buildCourses(session, classes, students);
 vi.mocked(fetchDeviceLessonPlans).mockResolvedValue({ plans: [plan(), plan({ class_id: "another" })] });
 await expect(loadExportPlans(session.id, courses, false)).rejects.toThrow("Ambiguous");
 vi.mocked(fetchDeviceLessonPlans).mockResolvedValue({ plans: [plan(), plan()] });
 await expect(loadExportPlans(session.id, courses, false)).rejects.toThrow("Duplicate");
});
it("propagates fetch failures and preserves guest roster-only export", async () => {
 const courses = buildCourses(session, classes, students);
 vi.mocked(fetchDeviceLessonPlans).mockRejectedValue(new Error("offline"));
 await expect(loadExportPlans(session.id, courses, false)).rejects.toThrow("offline");
 vi.mocked(fetchDeviceLessonPlans).mockClear();
 expect(await loadExportPlans(session.id, courses, true)).toEqual(courses);
 expect(fetchDeviceLessonPlans).not.toHaveBeenCalled();
});
