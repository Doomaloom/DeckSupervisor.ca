import catalog from "../../../features/instructor/ActivityLibrary/activities.json";
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

export type PrintedPlanRow = {
    skill: string;
    activities: { title: string; explanation: string }[];
    equipment: string[];
    location: string;
    duration: string;
};

// Old plans contain flattened library text; newer plans retain activity boundaries.
export function printedPlanRows(rows: LessonRow[]): PrintedPlanRow[] {
    return rows.map((row) => {
        const structured = row.activities?.filter((activity) => activity.text.trim());
        const activities = structured?.length ? structured : legacyActivities(row.activity);
        const equipment = [...(row.equipment || [])];
        const printedActivities = activities.map((activity) => {
            const paragraphs = activity.text.trim().split(/\n\s*\n/);
            const content = paragraphs.filter((paragraph) => {
                if (/^Suitable for\s*:/i.test(paragraph.trim())) return false;
                const match = paragraph.trim().match(/^Equipment\s*:\s*([\s\S]*)/i);
                if (!match) return true;
                if (match[1].trim()) equipment.push(match[1].trim());
                return false;
            }).join("\n\n");
            const newline = content.indexOf("\n");
            const named = activity.kind === "library" || newline >= 0;
            const title = named ? content.slice(0, newline >= 0 ? newline : undefined)
                .replace(/^(?:Front crawl|Back crawl|Breaststroke|Dry land)\s*:\s*/i, "").trim() : "";
            const explanation = named ? (newline >= 0 ? content.slice(newline).trim() : "") : content;
            return { title, explanation };
        });
        const uniqueEquipment = [...new Map(equipment.filter((item) => item.trim())
            .map((item) => [item.trim().toLowerCase(), item.trim()])).values()];
        return {
            skill: row.skill, activities: printedActivities, equipment: uniqueEquipment,
            location: row.location, duration: String(row.duration),
        };
    });
}

const libraryTitles = new Set(catalog.map((activity) => activity.title));

function legacyActivities(text: string): { kind: "library" | "custom"; text: string }[] {
    const paragraphs = text.trim().split(/\n\s*\n/);
    const groups: { kind: "library" | "custom"; text: string }[] = [];
    for (const [index, paragraph] of paragraphs.entries()) {
        const next = paragraphs[index + 1] || "";
        const library = libraryTitles.has(paragraph.trim()) ||
            (!/^(?:Suitable for|Equipment)\s*:/i.test(paragraph) &&
                /^(?:Suitable for|Equipment)\s*:/i.test(next));
        if (!groups.length || library) groups.push({ kind: library ? "library" : "custom", text: paragraph });
        else groups[groups.length - 1].text += `\n\n${paragraph}`;
    }
    return groups;
}
