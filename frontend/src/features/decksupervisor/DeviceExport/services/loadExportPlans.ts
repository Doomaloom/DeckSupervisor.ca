import { fetchDeviceLessonPlans } from "../../../../lib/serverApi";
import { findCurriculumLevel, findPlanningSkill } from "../../../instructor/LessonPlans/lessonSkills";
import type { ExportCourse } from "./exportPackage";

// Fetch at publication time so restarting a share publishes the latest saved plans.
export async function loadExportPlans(
    sessionId: string,
    courses: ExportCourse[],
    isGuest: boolean,
): Promise<ExportCourse[]> {
    if (isGuest) return courses; // Guest rosters have no server lesson plans.
    const { plans } = await fetchDeviceLessonPlans(sessionId);
    return courses.map(course => {
        const matching = plans.filter(plan =>
            plan.code === course.code &&
            plan.instructor.trim() === course.instructor.trim()
        );
        const dates = new Set<string>();
        const classIds = new Set(matching.map(plan => plan.class_id));
        if (classIds.size > 1) {
            throw new Error(
                `Ambiguous lesson plans for class ${course.code}. Resolve duplicate instructor classes before exporting.`,
            );
        }
        return {
            ...course,
            lessonPlans: matching.map(plan => {
                if (dates.has(plan.week)) {
                    throw new Error(
                        `Duplicate lesson plan for ${course.code} on ${plan.week}.`,
                    );
                }
                dates.add(plan.week);
                const level = findCurriculumLevel(course.level) ||
                    findCurriculumLevel(plan.curriculum_level || "");
                return {
                    date: plan.week,
                    curriculumLevel: level?.id || "",
                    rows: plan.rows.map(row => {
                        const skill = findPlanningSkill(level, row.skill);
                        return {
                            ...row,
                            ...(skill ? { skillId: skill.id } : {}),
                        };
                    }),
                };
            }),
        };
    });
}
