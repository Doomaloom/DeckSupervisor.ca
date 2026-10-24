import type { InstructorClass, InstructorSession, LessonPlan, LessonRow } from "../../../lib/serverApi";

// Bound each segment by visual line budget so even a 10,000-character activity can span pages.
export function textSegments(text: string, width: number) {
    const segments: string[] = [];
    let part = "";
    let lines = 0;
    let lineChars = 0;
    for (const char of text) {
        part += char;
        lineChars++;
        if (char === "\n" || lineChars >= width) {
            lines++;
            lineChars = 0;
        }
        if (lines >= 8) {
            const boundary = part.search(/\s+\S*$/);
            const cut = boundary > part.length / 2 ? boundary + 1 : part.length;
            segments.push(part.slice(0, cut));
            part = part.slice(cut);
            lines = 0;
            lineChars = part.length;
        }
    }
    if (part || !segments.length) segments.push(part);
    return segments;
}
export function lessonPlanHeading(
    session: InstructorSession,
    course: InstructorClass,
    plan: LessonPlan,
) {
    const weekNumber = session.weeks.indexOf(plan.week) + 1;
    return `${course.level} · ${course.code} · Week ${weekNumber || plan.week} Plan`;
}
export function hasActivityDrill(rows: Pick<LessonRow, "activity" | "equipment">[]) {
    return rows.some((row) => row.activity.trim().length > 0 || (row.equipment?.length ?? 0) > 0);
}
