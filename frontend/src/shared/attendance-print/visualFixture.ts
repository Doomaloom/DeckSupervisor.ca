import { buildLessonPlanMarkingDocument } from "./buildLessonPlanMarkingDocument";
import { fitCompletedAttendancePages } from "./fitCompletedAttendancePages";
import { prepareSkillMarkingLayout } from "./prepareSkillMarkingLayout";
import { buildCombinedSkillMarkingDocument, buildSkillMarkingDocument } from "./buildSkillMarkingDocument";
import { curriculumLevels } from "../../features/instructor/LessonPlans/lessonSkills";
import type { InstructorClass, InstructorSession, LessonPlan } from "../../lib/serverApi";
import { prepareSchematicCoversForPrint } from "./schematicCover";
import { buildAttendancePrintDocument } from "./buildAttendancePrintDocument";
import completedMap from './completedPrintMap.json';
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from "./templateRegistry";
import type { AttendancePrintItem, AttendancePrintRequest } from "./types";

declare global {
    interface Window {
        __ATTENDANCE_FIXTURE_READY__?: boolean;
        __ATTENDANCE_FIXTURE_ERROR__?: string;
    }
}

const students = [
    { name: "Avery Adams" },
    { name: "Blair Brown" },
    { name: "Casey Chen" },
];

function item(
    template: string,
    code = "00123",
    instructor = "Alex Instructor",
): AttendancePrintItem {
    return {
        template,
        roster: {
            code,
            level: template,
            serviceName: template,
            time: "9:00 AM",
            instructor,
            location: "Main Pool",
            schedule: "Mon 2026-07-06",
            students,
        },
    };
}

// ?students=N and ?dates=N size a fixture class so print layouts can be measured at real class sizes.
const fixtureParams = new URLSearchParams(window.location.search);
const studentCount = Number(fixtureParams.get("students")) || 0;
const dateCount = Number(fixtureParams.get("dates")) || 3;
const sizedStudents = (count: number) => Array.from({ length: count }, (_, index) => ({ name: index === 3 ? 'Alexandria-Marguerite Long Synthetic Name' : `${['Avery Adams', 'Blair Brown', 'Casey Chen'][index % 3]} ${index + 1}` }));

function fixture(
    name: string,
): {
    request: AttendancePrintRequest;
    options?: Parameters<typeof buildAttendancePrintDocument>[1];
} {
    if (name.startsWith('completed-')) {
        const template = name === 'completed-overflow' ? 'Splash1' : name.slice('completed-'.length);
        const roster = item(template).roster;
        const columns = completedMap.levels[template as keyof typeof completedMap.levels];
        if (!columns?.length) throw new Error('Completed fixture needs an assessed level.');
        const lessonDates = Array.from({ length: dateCount }, (_, index) => new Date(Date.UTC(2026, 6, 6 + index * 7)).toISOString().slice(0, 10));
        roster.completed = {curriculumVersion:completedMap.curriculumVersion, lessonDates};
        roster.students = Array.from({length:studentCount || (name === 'completed-overflow' ? 20 : 4)}, (_,index) => ({
            name: index === 3 ? 'Alexandria-Marguerite Long Synthetic Name' : `${['Avery Adams','Blair Brown','Casey Chen'][index % 3]} ${index + 1}`,
            enrollmentId:`enrollment-${index}`,
            results:{
                attendance:Object.fromEntries(lessonDates.slice(0, -1).map((date, day) => [date, (day + index) % 5 ? 'present' as const : 'absent' as const])),
                successfulAttempts:Object.fromEntries(columns.flatMap(column=>column.skillIds.map(id=>[id,index % 4]))),
            },
        }));
        return {request:{template, roster, session:'Summer 2026',title:'Completed attendance'}};
    }
    const template = name.replace(/^attendance-/, "");
    if (
        LEGACY_ATTENDANCE_TEMPLATE_KEYS.includes(
            template as typeof LEGACY_ATTENDANCE_TEMPLATE_KEYS[number],
        )
    ) {
        const roster = item(template).roster;
        if (studentCount) roster.students = sizedStudents(studentCount);
        return {
            request: {
                template,
                roster,
                session: "Summer 2026",
                title: template,
            },
        };
    }
    if (name === "paired") {
        return {
            request: {
                rosters: [item("Splash2A"), item("Splash2B")],
                session: "Summer 2026",
                title: "Paired attendance",
            },
        };
    }
    if (name === "odd") {
        return {
            request: {
                rosters: [
                    item("Splash1", "100"),
                    item("Splash2A", "100"),
                    item("Splash3", "300"),
                ],
                session: "Summer 2026",
                title: "Odd attendance",
            },
        };
    }
    if (name === "covers") {
        return {
            request: {
                rosters: [item("Splash1")],
                session: "Summer 2026",
                title: "Attendance with cover",
            },
            options: {
                schematicCover: {
                    blankBack: true,
                    request: {
                        orientation: "landscape",
                        title: "Monday Schematic",
                        dateRange: "Jul 6 – Aug 24, 2026",
                        instructors: ["Alex Instructor"],
                        columns: [[{
                            code: "00123",
                            level: "Splash 1",
                            startMinutes: 540,
                            durationMinutes: 30,
                            studentCount: 3,
                            capacity: 6,
                        }]],
                    },
                },
            },
        };
    }
    throw new Error(`Unknown attendance fixture: ${name}`);
}

async function mount() {
    const name = new URLSearchParams(window.location.search).get("fixture") ||
        "attendance-Splash1";
    let source: Document;
    if (name.startsWith("marking")) {
        const level = curriculumLevels.find((entry) => entry.id === "LittleSplash1")!;
        const session = { session_day: "Mo", session_season: "Fall", session_year: 2026, weeks: ["2026-10-05"], location: "Main Pool" } as InstructorSession;
        const course = { level: name === "marking-private" ? "Private" : level.name, code: "00123", instructor: "Alex Instructor", start_time: "09:00", end_time: "09:30" } as InstructorClass;
        const skills = name === "marking-empty" ? [] : name === "marking-long" ? level.skills : [level.skills[0], level.skills.at(-1)!];
        const plan = { week: "2026-10-05", curriculum_level: level.id, rows: name === "marking-overflow" ? Array.from({ length: 16 }, (_, index) => ({ skill: `Wide bold skill ${index + 1}: ${"W".repeat(110)}` })) : skills.map((skill) => ({ skill: skill.name })) } as LessonPlan;
        const names = Array.from({ length: 12 }, (_, index) => ({ name: `${["Avery Adams", "Blair Brown", "Casey Chen", "Alexandra Long-Synthetic-Studentname"][index % 4]} ${index + 1}` }));
        source = name.startsWith("marking-interleaved")
            ? buildLessonPlanMarkingDocument(session, [
                { course: { ...course, id: "a" }, plan: { ...plan, rows: skills.map((skill, index) => ({ skill: skill.name, activity: name.endsWith("long") ? `Activity ${index + 1}: Practice technique with feedback. `.repeat(130) : "Practice with feedback.", activities: name.endsWith("long") ? undefined : [{ kind: "library" as const, text: "Front crawl: Torpedo kicking\n\nSuitable for: Swimmer 1-6\n\nEquipment: Kickboard\n\nPractise hip-led kicking face down in a streamlined position." }, { kind: "custom" as const, text: "Partner challenge\n\nTake turns practising the skill while a partner observes." }], equipment: ["Noodles"], location: "Lane 2", duration: 10 })) }, students: names },
                { course: { ...course, id: "b", code: "00456", level: "Private" }, plan: { ...plan, rows: skills.map((skill) => ({ skill: skill.name, activity: "", location: "Shallow end", duration: 5 })) } },
            ])
            : name === "marking-combined"
            ? buildCombinedSkillMarkingDocument(session, [
                { course, plan, students: names },
                { course: { ...course, code: "00456", level: "Private" }, plan },
            ])
            : buildSkillMarkingDocument(session, course, plan, name === "marking-names" ? names : []);
    } else {
        const selected = fixture(name);
        source = await buildAttendancePrintDocument(selected.request, selected.options);
    }
    document.title = source.title;
    document.body.className = source.body.className;
    window.addEventListener("beforeprint", () => prepareSchematicCoversForPrint(window));
    document.head.replaceChildren(
        ...Array.from(
            source.head.childNodes,
            (node) => document.importNode(node, true),
        ),
    );
    document.body.replaceChildren(
        ...Array.from(
            source.body.childNodes,
            (node) => document.importNode(node, true),
        ),
    );
    await document.fonts.ready;
    prepareSkillMarkingLayout(document);
    fitCompletedAttendancePages(document);
    window.addEventListener("beforeprint", () => prepareSkillMarkingLayout(document));
    window.__ATTENDANCE_FIXTURE_READY__ = true;
}

void mount().catch((error) => {
    window.__ATTENDANCE_FIXTURE_ERROR__ = error instanceof Error
        ? error.message
        : String(error);
    document.body.textContent = window.__ATTENDANCE_FIXTURE_ERROR__;
});
