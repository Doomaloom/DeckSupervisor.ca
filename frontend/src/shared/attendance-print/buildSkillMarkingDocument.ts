import template from "./templates/SkillMarking.html?raw";
import compatibilityCss from "./attendanceCompatibility.css?inline";
import { attendanceFontCss } from "./buildAttendancePrintDocument";
import { fillAttendanceRoster } from "./templateDom";
import { plannedSkillSubskills } from "../../features/instructor/LessonPlans/lessonSkills";
import { sessionLabel } from "../session/instructorSessionLabels";
import type { AttendancePrintStudent } from "./types";
import type { InstructorClass, InstructorSession, LessonPlan } from "../../lib/serverApi";

// Bound rotated labels so compact marking columns remain legible.
function labelSegments(text: string) {
    const parts = text.match(/[\s\S]{1,140}(?:\s|$)|[\s\S]{1,140}/g) || [""];
    return parts;
}

export function markingColumns(course: InstructorClass, plan: LessonPlan) {
    return plannedSkillSubskills(course.level, plan.curriculum_level, plan.rows)
        .flatMap(({ name, subskills }, skillIndex) => [
            ...labelSegments(`${skillIndex + 1}. ${name}`).map((text) => ({ text, planned: true })),
            ...(subskills.length ? subskills.flatMap((subskill, index) =>
                labelSegments(`${skillIndex + 1}.${index + 1} ${subskill.group.length ? `${subskill.group.join(" / ")}: ` : ""}${subskill.text}`)
                    .map((text) => ({ text, planned: false }))
            ) : [{ text: `${skillIndex + 1}.1 Subskills unavailable`, planned: false }]),
        ]);
}

export function buildSkillMarkingDocument(session: InstructorSession, course: InstructorClass, plan: LessonPlan, students: AttendancePrintStudent[] = []): Document {
    const document = new DOMParser().parseFromString(template, "text/html");
    document.title = `Skill marking - ${course.code} - ${plan.week}`;
    const policy = document.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "default-src 'self' data: blob:; script-src 'none'; style-src 'unsafe-inline'; font-src 'self' data: blob:";
    document.head.prepend(policy);
    const style = document.createElement("style");
    style.textContent = `${attendanceFontCss()}\n${compatibilityCss}`;
    policy.after(style);
    const source = document.querySelector<HTMLElement>(".marking-page")!;
    source.remove();
    const columns = markingColumns(course, plan);
    // Use the freed attendance space for taller labels and a narrower name field.
    // Up to 32 criteria fit on one landscape sheet with readable marking cells.
    const columnLimit = 32;
    const columnsPerPage = Math.min(columnLimit, Math.max(10, columns.length));
    const columnPages = Math.max(1, Math.ceil(columns.length / columnsPerPage));
    const studentRows = students.length ? students : Array.from({ length: 10 }, () => ({ name: "" }));
    const studentPages = Math.ceil(studentRows.length / 14);
    const pageCount = columnPages * studentPages;
    const weekNumber = session.weeks.indexOf(plan.week) + 1;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = source.cloneNode(true) as HTMLElement;
        const setText = (id: string, text: string) => { page.querySelector(`#${id}`)!.textContent = text; };
        setText("level", course.level);
        setText("lesson", `Week ${weekNumber || plan.week} | ${plan.week}`);
        setText("page-number", `${pageIndex + 1} / ${pageCount}`);
        const header = page.querySelector("#student-rows")!;
        const columnPage = pageIndex % columnPages;
        const studentPage = Math.floor(pageIndex / columnPages);
        const pageColumns = columns.slice(columnPage * columnsPerPage, (columnPage + 1) * columnsPerPage);
        page.style.setProperty("--criterion-font-size", columnsPerPage > 24 ? "8.5px" : "10px");
        page.style.setProperty("--student-row-height", students.length > 12 ? "20px" : "30px");
        if (!pageColumns.length) pageColumns.push({ text: "No planned skills in this saved lesson plan.", planned: false });
        // Keep the regular attendance grid width on the final continuation sheet.
        while (pageColumns.length < columnsPerPage) pageColumns.push({ text: "", planned: false });
        for (const column of pageColumns) {
            const cell = document.createElement("td");
            cell.className = "marking-criterion";
            cell.dataset.planned = String(column.planned);
            const label = document.createElement("span");
            label.textContent = column.text;
            cell.append(label);
            header.append(cell);
        }
        fillAttendanceRoster(page, {
            code: course.code, level: course.level, serviceName: course.level,
            instructor: course.instructor, location: session.location || "",
            schedule: `${session.session_day} ${plan.week}`,
            time: `${course.start_time.slice(0, 5)}-${course.end_time.slice(0, 5)}`,
            students: studentRows.slice(studentPage * 14, (studentPage + 1) * 14),
        }, sessionLabel(session), { dailyAttendance: false });
        // Repeated sheets use data fields so IDs remain unique in the document.
        page.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
            element.dataset.field = element.id;
            element.removeAttribute("id");
        });
        document.body.append(page);
    }
    return document;
}

export function buildCombinedSkillMarkingDocument(session: InstructorSession, entries: { course: InstructorClass; plan: LessonPlan; students?: AttendancePrintStudent[] }[]): Document {
    if (!entries.length) throw new Error("No saved lesson plans to print.");
    const document = buildSkillMarkingDocument(session, entries[0].course, entries[0].plan, entries[0].students);
    document.title = `Skill marking sheets - ${entries[0].plan.week}`;
    for (const entry of entries.slice(1)) {
        const next = buildSkillMarkingDocument(session, entry.course, entry.plan, entry.students);
        Array.from(next.body.children).forEach((page) => document.body.append(document.importNode(page, true)));
    }
    return document;
}
