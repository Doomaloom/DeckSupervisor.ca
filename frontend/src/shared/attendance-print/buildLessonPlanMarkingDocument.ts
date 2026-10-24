import type { InstructorClass, InstructorSession, LessonPlan } from "../../lib/serverApi";
import { plannedSkillSubskills } from "../../features/instructor/LessonPlans/lessonSkills";
import { lessonPlanHeading, printedPlanRows, textSegments } from "../pdf/lessonPlan/lessonPlanContent";
import { sessionLabel } from "../session/instructorSessionLabels";
import { buildSkillMarkingDocument } from "./buildSkillMarkingDocument";
import type { AttendancePrintStudent } from "./types";

const planStyles = `
@page lesson-plan { size: letter portrait; margin: 26pt 32pt 40pt; }
@page lesson-marking { size: letter landscape; margin: 0.2in; }
.lesson-plan-print {
    page: lesson-plan; font: 10pt/1.3 Arial, sans-serif;
    break-inside: auto; page-break-inside: auto;
}
.marking-page { page: lesson-marking; }
.lesson-plan-print header { margin-bottom: 27pt; break-inside: avoid; }
.lesson-plan-print h1 { font-size: 17pt; margin: 0 0 5pt; }
.lesson-plan-print p { margin: 0; }
.lesson-plan-print table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.lesson-plan-print th, .lesson-plan-print td {
    padding: 6pt; border: 1px solid black; vertical-align: top;
    white-space: pre-wrap; overflow-wrap: anywhere; text-align: left;
}
.lesson-plan-print th { background: #edf2f7; font-size: 9pt; }
.lesson-plan-print tr { break-inside: avoid; }
.lesson-plan-print tr.plan-long-activity { break-inside: auto; }
.lesson-plan-print .plan-activity + .plan-activity { margin-top: 8pt; }
.lesson-plan-print .plan-row-skill, .lesson-plan-print .plan-activity-title { display: block; margin-bottom: 4pt; }
.lesson-plan-print .plan-subskills { margin-top: 18pt; }
.lesson-plan-print h2 { font-size: 13pt; margin: 0 0 9pt; break-after: avoid; }
.lesson-plan-print h3 { font-size: 10pt; margin: 0 0 3pt; break-after: avoid; }
.lesson-plan-print .plan-skill { margin-bottom: 9pt; }
.lesson-plan-print .plan-subskill { font-size: 9pt; margin: 0 0 2pt 12pt; }
@media screen {
    .lesson-plan-print { box-sizing: border-box; width: 816px; min-height: 1056px; padding: 26pt 32pt 40pt; }
}
`;

function appendText(document: Document, parent: Element, tag: string, text: string) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
}

function buildPlanSection(document: Document, session: InstructorSession, course: InstructorClass, plan: LessonPlan) {
    const section = document.createElement("section");
    section.className = "print-page lesson-plan-print";
    section.dataset.classId = course.id;
    const header = document.createElement("header");
    section.append(header);
    appendText(document, header, "h1", lessonPlanHeading(session, course, plan));
    appendText(document, header, "p", `${course.instructor} | ${course.level} | ${course.code} | ${course.start_time.slice(0, 5)}-${course.end_time.slice(0, 5)}`);
    appendText(document, header, "p", sessionLabel(session));
    const table = document.createElement("table");
    const colgroup = document.createElement("colgroup");
    for (const width of [53, 17, 17, 13]) {
        const col = document.createElement("col");
        col.style.width = `${width}%`;
        colgroup.append(col);
    }
    const heading = document.createElement("thead");
    const headingRow = document.createElement("tr");
    heading.append(headingRow);
    for (const label of ["Skill / Activity / drill", "Equipment", "Pool location", "Duration (minutes)"]) {
        appendText(document, headingRow, "th", label);
    }
    const body = document.createElement("tbody");
    table.append(colgroup, heading, body);
    section.append(table);
    for (const row of printedPlanRows(plan.rows)) {
        const tr = document.createElement("tr");
        const contentParts = [
            textSegments([row.skill, ...row.activities.flatMap(({ title, explanation }) => [title, explanation])].join("\n"), 43),
            textSegments(row.equipment.join("\n"), 13),
            textSegments(row.location, 13),
        ];
        if (contentParts.some((parts) => parts.length > 4)) tr.className = "plan-long-activity";
        const detail = document.createElement("td");
        appendText(document, detail, "strong", row.skill).className = "plan-row-skill";
        for (const activity of row.activities) {
            const block = document.createElement("div");
            block.className = "plan-activity";
            if (activity.title) appendText(document, block, "em", activity.title).className = "plan-activity-title";
            if (activity.explanation) appendText(document, block, "p", activity.explanation).className = "plan-activity-explanation";
            detail.append(block);
        }
        tr.append(detail);
        for (const value of [row.equipment.join("\n"), row.location, row.duration]) {
            appendText(document, tr, "td", value);
        }
        body.append(tr);
    }
    if (!plan.rows.length) appendText(document, section, "p", "No activities in this saved plan.");
    const skills = plannedSkillSubskills(course.level, plan.curriculum_level, plan.rows);
    if (skills.length) {
        const subskills = document.createElement("div");
        subskills.className = "plan-subskills";
        appendText(document, subskills, "h2", "Subskills");
        for (const skill of skills) {
            const group = document.createElement("div");
            group.className = "plan-skill";
            appendText(document, group, "h3", skill.name);
            if (!skill.subskills.length) appendText(document, group, "p", "Subskills unavailable");
            for (const subskill of skill.subskills) {
                appendText(document, group, "p", `• ${subskill.group.length ? `${subskill.group.join(" / ")}: ` : ""}${subskill.text}`).className = "plan-subskill";
            }
            subskills.append(group);
        }
        section.append(subskills);
    }
    return section;
}

export function buildLessonPlanMarkingDocument(session: InstructorSession, entries: {
    course: InstructorClass;
    plan: LessonPlan;
    students?: AttendancePrintStudent[];
}[]): Document {
    if (!entries.length) throw new Error("No saved lesson plans to print.");
    const first = entries[0];
    const document = buildSkillMarkingDocument(session, first.course, first.plan, first.students);
    document.body.replaceChildren();
    document.title = `Lesson plans and marking sheets - ${first.plan.week}`;
    const style = document.createElement("style");
    style.textContent = planStyles;
    document.head.append(style);
    for (const { course, plan, students } of entries) {
        document.body.append(buildPlanSection(document, session, course, plan));
        const marking = buildSkillMarkingDocument(session, course, plan, students);
        for (const page of Array.from(marking.body.children)) {
            const copy = document.importNode(page, true) as HTMLElement;
            copy.dataset.classId = course.id;
            document.body.append(copy);
        }
    }
    return document;
}
