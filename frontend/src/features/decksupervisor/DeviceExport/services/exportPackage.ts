import type { SessionRecord } from "../../../../app/useCurrentSession";
import type { ExtractedClass, Student } from "../../../../types/app";
import { sanitizeLevel } from "../../Rosters/utils";

export type ExportCourse = {
    code: string;
    name: string;
    level: string;
    startTime: string;
    location: string;
    instructor: string;
    students: Student[];
    lessonDates: string[];
};
export type ClassPackage = {
    schemaVersion: 1;
    kind: "rec-tablet-classes";
    datasetId: string;
    instructor: string;
    courses: Array<
        {
            sourceId: string;
            name: string;
            level: string;
            startTime: string;
            location: string;
            lessonDates: string[];
            swimmers: Array<{ sourceId: string; name: string; level?: string }>;
        }
    >;
};
export type ExportRegistry = {
    schemaVersion: 1;
    kind: "rec-tablet-export-ids";
    sessionId: string;
    datasetId: string;
    people: Record<
        string,
        { sourceId: string; courseId: string; name: string }
    >;
    dates?: Record<string, string[]>;
};
const days = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const limit = 10 * 1024 * 1024;
export const MAX_EXPORT_BYTES = limit;

function required(value: string, label: string) {
    if (typeof value !== "string") throw new Error(`${label} must be text.`);
    const text = value.trim();
    if (!text || [...text].length > 1000) {
        throw new Error(`${label} must contain 1–1000 characters.`);
    }
    return text;
}
export function parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00Z`);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000") ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        throw new Error(
            `Invalid lesson date: ${value || "(empty)"}. Use YYYY-MM-DD.`,
        );
    }
    return date;
}
export function parseDates(value: string): string[] {
    const dates = value.split(/[\s,]+/).filter(Boolean);
    if (!dates.length || dates.length > 366) {
        throw new Error("Each class needs 1–366 lesson dates.");
    }
    dates.forEach(parseDate);
    if (new Set(dates).size !== dates.length) {
        throw new Error("Remove duplicate lesson dates.");
    }
    return dates.sort();
}
export function suggestDates(session: SessionRecord, schedule = ""): string[] {
    try {
        let start = parseDate(session.start_date ?? "").getTime();
        let end = parseDate(session.end_date ?? "").getTime();
        // Only unambiguous ISO source ranges can narrow a session's date range.
        const sourceDates = schedule.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
        if (sourceDates.length) {
            start = Math.max(start, parseDate(sourceDates[0]!).getTime());
        }
        if (sourceDates.length > 1) {
            end = Math.min(end, parseDate(sourceDates[1]!).getTime());
        }
        const tokens = session.session_day.toLowerCase().split(/[\s,]+/).filter(
            Boolean,
        );
        const weekdays = tokens.map((token) => days.indexOf(token.slice(0, 2)));
        if (
            weekdays.some((day) => day < 0) || !weekdays.length ||
            end < start ||
            end - start > 366 * 86400000
        ) return [];
        const dates: string[] = [];
        for (let t = start; t <= end; t += 86400000) {
            const date = new Date(t);
            if (weekdays.includes(date.getUTCDay())) {
                dates.push(date.toISOString().slice(0, 10));
            }
        }
        return dates;
    } catch {
        return [];
    }
}
export function startTime(value: string): string {
    const first = value.trim().split(/\s*[-–]\s*/)[0];
    const match = first.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) throw new Error(`Unrecognized class start time: ${value}.`);
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) {
        throw new Error(`Invalid class start time: ${value}.`);
    }
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
const dayKey = (day: string) =>
    day.toLowerCase().split(/[\s,]+/).map((token) => token.slice(0, 2)).sort()
        .join(",");
const locationKey = (location: string) =>
    location.trim().toLowerCase().replace(/\s+/g, " ");

export function buildCourses(
    session: SessionRecord,
    metadata: ExtractedClass[],
    students: Student[],
): ExportCourse[] {
    if (!metadata.length) {
        throw new Error(
            "Load the CSV for this session before exporting. No class list is loaded for the selected session.",
        );
    }
    const seen = new Set<string>();
    return metadata.map((item) => {
        const code = required(item.courseCode, "Course code");
        if (seen.has(code)) {
            throw new Error(
                `Course code ${code} is ambiguous in this session. Resolve the duplicate class before exporting.`,
            );
        }
        seen.add(code);
        if (
            (session.session_year &&
                item.sessionYear !== session.session_year) ||
            (session.session_season &&
                item.sessionSeason.toLowerCase() !==
                session.session_season.toLowerCase())
        ) {
            throw new Error(
                "The loaded classes do not match the selected session term.",
            );
        }
        if (dayKey(item.dayOfWeek) !== dayKey(session.session_day)) {
            throw new Error(
                "The loaded classes do not match the selected session day. Reload the session data.",
            );
        }
        const start = startTime(item.startTime24);
        const matching = students.filter((student) =>
            student.code.trim() === code &&
            dayKey(student.day) === dayKey(item.dayOfWeek) &&
            locationKey(student.location) === locationKey(item.location) &&
            startTime(student.time) === start
        );
        if (!matching.length && item.studentCount > 0) {
            throw new Error(
                `The roster for ${code} is not loaded. Load this session's CSV before exporting.`,
            );
        }
        const booked = matching.filter((student) => !student.waitlist);
        const assigned = new Set(
            booked.map((student) => student.instructor.trim()).filter(Boolean),
        );
        if (!booked.length) {
            matching.forEach((student) => {
                if (student.instructor.trim()) {
                    assigned.add(student.instructor.trim());
                }
            });
        }
        if (assigned.size > 1) {
            throw new Error(
                `Class ${code} has conflicting instructor assignments. Assign the class to one instructor in Rosters or Schematic.`,
            );
        }
        return {
            code,
            name: required(item.serviceName, "Class name"),
            level: sanitizeLevel(required(item.serviceName, "Class level")),
            startTime: start,
            location: item.location.trim(),
            instructor: [...assigned][0] ?? "",
            students: booked,
            lessonDates: suggestDates(session, matching[0]?.schedule),
        };
    }).sort((a, b) =>
        a.startTime.localeCompare(b.startTime) || a.code.localeCompare(b.code)
    );
}
export function newRegistry(sessionId: string): ExportRegistry {
    return {
        schemaVersion: 1,
        kind: "rec-tablet-export-ids",
        sessionId: required(sessionId, "Session ID"),
        datasetId: `decksupervisor:${crypto.randomUUID()}`,
        people: {},
    };
}
export function readRegistry(text: string, sessionId: string): ExportRegistry {
    if (new TextEncoder().encode(text).length > limit) {
        throw new Error("ID backup is too large.");
    }
    const value: ExportRegistry = JSON.parse(text);
    if (
        value?.schemaVersion !== 1 || value.kind !== "rec-tablet-export-ids" ||
        value.sessionId !== sessionId || !value.people ||
        typeof value.people !== "object" || Array.isArray(value.people)
    ) throw new Error("Choose an export ID backup for this selected session.");
    required(value.datasetId, "Dataset ID");
    const ids = new Set<string>();
    for (const [fingerprint, person] of Object.entries(value.people)) {
        if (
            !/^[a-f0-9]{64}$/.test(fingerprint) || !person ||
            typeof person !== "object"
        ) throw new Error("Invalid export ID backup.");
        required(person.sourceId, "Swimmer ID");
        required(person.courseId, "Course ID");
        required(person.name, "Swimmer name");
        if (ids.has(person.sourceId)) {
            throw new Error("Duplicate swimmer ID in backup.");
        }
        ids.add(person.sourceId);
    }
    for (const dates of Object.values(value.dates ?? {})) {
        if (
            !Array.isArray(dates) ||
            dates.some((date) => typeof date !== "string")
        ) throw new Error("Invalid dates in ID backup.");
        parseDates(dates.join("\n"));
    }
    return value;
}
async function fingerprint(parts: string[]): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(parts));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(
        new Uint8Array(digest),
        (b) => b.toString(16).padStart(2, "0"),
    ).join("");
}
export async function buildPackage(
    sessionId: string,
    instructor: string,
    courses: ExportCourse[],
    sourceRegistry: ExportRegistry,
): Promise<{ package: ClassPackage; registry: ExportRegistry }> {
    const registry = readRegistry(JSON.stringify(sourceRegistry), sessionId);
    const selected = courses.filter((course) =>
        course.instructor === instructor
    );
    required(instructor, "Instructor");
    if (!selected.length || selected.length > 1000) {
        throw new Error("Select an instructor with 1–1000 assigned classes.");
    }
    const output: ClassPackage = {
        schemaVersion: 1,
        kind: "rec-tablet-classes",
        datasetId: registry.datasetId,
        instructor,
        courses: [],
    };
    for (const course of selected) {
        const sourceId = `session:${sessionId}:course:${required(course.code, "Course code")
            }`;
        required(sourceId, "Course ID");
        if (course.students.length > 500) {
            throw new Error(`Class ${course.code} exceeds 500 swimmers.`);
        }
        const seen = new Set<string>();
        const swimmers: ClassPackage["courses"][number]["swimmers"] = [];
        for (const student of course.students) {
            if (student.waitlist) continue;
            const name = required(student.name, "Swimmer name");
            const sourceLevel = student.level?.trim() ?? "";
            const normalizedStudentLevel = sourceLevel
                ? sanitizeLevel(sourceLevel)
                : "";
            const level = course.level === "SplashPrivate" &&
                (!sourceLevel || normalizedStudentLevel === "SplashPrivate")
                ? undefined
                : sanitizeLevel(
                    required(sourceLevel || course.level, `Level for ${name}`),
                );
            if (level === "SplashPrivate" || level === "Splash2") {
                throw new Error(
                    `Choose an actual level for ${name} in Rosters (for example Splash 2A or 2B).`,
                );
            }
            // UUIDs are retained against an exact source signature; row order, display
            // IDs, class times, instructor changes and skill edits cannot change them.
            const key = await fingerprint([
                sourceId,
                name,
                student.phone.trim(),
            ]);
            if (seen.has(key)) {
                throw new Error(
                    `Class ${course.code} has indistinguishable entries for ${name}. Resolve them in the source roster before exporting.`,
                );
            }
            seen.add(key);
            if (!registry.people[key]) {
                const previous = Object.values(sourceRegistry.people).find((
                    person,
                ) => person.courseId === sourceId && person.name === name);
                if (previous) {
                    throw new Error(
                        `Source details changed for ${name} in ${course.code}. Restore the original contact value or reconcile the source identity before exporting; a new ID would split their progress.`,
                    );
                }
                registry.people[key] = {
                    sourceId: crypto.randomUUID(),
                    courseId: sourceId,
                    name,
                };
            }
            const person = registry.people[key];
            if (person.name !== name || person.courseId !== sourceId) {
                throw new Error("The ID backup does not match this roster.");
            }
            swimmers.push({
                sourceId: person.sourceId,
                name,
                ...(level ? { level } : {}),
            });
        }
        if ([...course.location].length > 1000) {
            throw new Error("Class location exceeds 1000 characters.");
        }
        registry.dates = {
            ...registry.dates,
            [course.code]: parseDates(course.lessonDates.join("\n")),
        };
        output.courses.push({
            sourceId,
            name: required(course.name, "Class name"),
            level: required(course.level, "Class level"),
            startTime: startTime(course.startTime),
            location: course.location,
            lessonDates: parseDates(course.lessonDates.join("\n")),
            swimmers: swimmers.sort((a, b) =>
                a.sourceId.localeCompare(b.sourceId)
            ),
        });
    }
    if (
        new TextEncoder().encode(JSON.stringify(output, null, 2) + "\n")
            .length >
        limit
    ) throw new Error("Export exceeds the device’s 10 MB limit.");
    return { package: output, registry };
}
